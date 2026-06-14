import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  payloadFromRow,
  safeLimit,
} from './publicHelpers.mjs';

export function barsForSeries(series) {
  return Array.isArray(series?.bars) ? series.bars : [];
}

export async function queryPublicPriceSeriesCandlesRow(options = {}) {
  const symbol = cleanText(options.symbol).toUpperCase();
  if (!symbol) return null;
  const result = await queryKysely(
    `
      WITH candidates AS (
        SELECT payload, last_bar_date, fetched_at, 1 AS priority FROM price_series WHERE upper(COALESCE(symbol, '')) = $1
        UNION ALL
        SELECT payload, last_bar_date, fetched_at, 2 AS priority FROM price_series WHERE upper(COALESCE(display_symbol, '')) = $1
        UNION ALL
        SELECT payload, last_bar_date, fetched_at, 3 AS priority FROM price_series WHERE upper(COALESCE(yahoo_symbol, '')) = $1
        UNION ALL
        SELECT payload, last_bar_date, fetched_at, 4 AS priority FROM price_series WHERE upper(COALESCE(payload->>'krxSymbol', '')) = $1
        UNION ALL
        SELECT payload, last_bar_date, fetched_at, 5 AS priority FROM price_series WHERE upper(COALESCE(payload->>'displaySymbol', '')) = $1
        UNION ALL
        SELECT payload, last_bar_date, fetched_at, 6 AS priority FROM price_series WHERE upper(COALESCE(payload->>'yahooSymbol', '')) = $1
      )
      SELECT payload
      FROM candidates
      ORDER BY priority ASC, last_bar_date DESC NULLS LAST, fetched_at DESC NULLS LAST
      LIMIT 1
    `,
    [symbol],
  );
  const series = payloadFromRow(result.rows[0]);
  if (!series) return null;
  const from = Number(options.from) * 1000;
  const to = Number(options.to) * 1000;
  const bars = barsForSeries(series).filter((bar) => {
    const t = Date.parse(`${bar.date}T00:00:00.000Z`);
    if (!Number.isFinite(t)) return false;
    return (!Number.isFinite(from) || t >= from) && (!Number.isFinite(to) || t <= to);
  });
  if (bars.length === 0) return null;
  return {
    s: 'ok',
    t: bars.map((bar) => Math.floor(Date.parse(`${bar.date}T00:00:00.000Z`) / 1000)),
    o: bars.map((bar) => Number(bar.open ?? bar.close)),
    h: bars.map((bar) => Number(bar.high ?? bar.close)),
    l: bars.map((bar) => Number(bar.low ?? bar.close)),
    c: bars.map((bar) => Number(bar.close)),
    v: bars.map((bar) => Number(bar.volume) || 0),
  };
}
