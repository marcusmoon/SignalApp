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

export async function queryPublicPriceSeriesSparklineRows(options = {}) {
  const symbols = cleanText(options.symbols)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const days = safeLimit(options.days, 30, 365);
  if (symbols.length === 0) return [];
  const result = await queryKysely(
    `
      WITH requested(symbol, ord) AS (
        SELECT * FROM unnest($1::text[]) WITH ORDINALITY
      ),
      candidates AS (
        SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.last_bar_date, p.fetched_at, 1 AS priority
        FROM requested r JOIN price_series p ON upper(COALESCE(p.symbol, '')) = r.symbol
        UNION ALL
        SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.last_bar_date, p.fetched_at, 2 AS priority
        FROM requested r JOIN price_series p ON upper(COALESCE(p.display_symbol, '')) = r.symbol
        UNION ALL
        SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.last_bar_date, p.fetched_at, 3 AS priority
        FROM requested r JOIN price_series p ON upper(COALESCE(p.yahoo_symbol, '')) = r.symbol
        UNION ALL
        SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.last_bar_date, p.fetched_at, 4 AS priority
        FROM requested r JOIN price_series p ON upper(COALESCE(p.payload->>'krxSymbol', '')) = r.symbol
        UNION ALL
        SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.last_bar_date, p.fetched_at, 5 AS priority
        FROM requested r JOIN price_series p ON upper(COALESCE(p.payload->>'displaySymbol', '')) = r.symbol
        UNION ALL
        SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.last_bar_date, p.fetched_at, 6 AS priority
        FROM requested r JOIN price_series p ON upper(COALESCE(p.payload->>'yahooSymbol', '')) = r.symbol
      )
      SELECT DISTINCT ON (requested_symbol) requested_symbol, payload
      FROM candidates
      ORDER BY requested_symbol, priority ASC, last_bar_date DESC NULLS LAST, fetched_at DESC NULLS LAST
    `,
    [symbols],
  );
  const bySymbol = new Map();
  for (const row of result.rows) {
    const series = payloadFromRow(row);
    const key = cleanText(row.requested_symbol).toUpperCase();
    if (key && series) bySymbol.set(key, series);
  }
  return symbols
    .map((symbol) => {
      const series = bySymbol.get(symbol);
      const bars = barsForSeries(series).slice(-days);
      const closes = bars.map((bar) => Number(bar.close)).filter((value) => Number.isFinite(value));
      const first = closes[0];
      const last = closes[closes.length - 1];
      const changePercent = Number.isFinite(first) && first !== 0 && Number.isFinite(last)
        ? ((last - first) / first) * 100
        : null;
      return {
        symbol,
        displaySymbol: series?.displaySymbol || symbol,
        currency: series?.currency || null,
        lastClose: Number.isFinite(last) ? last : null,
        lastBarDate: bars[bars.length - 1]?.date || series?.lastBarDate || null,
        changePercent,
        closes,
        fetchedAt: series?.fetchedAt || null,
      };
    })
    .filter((row) => row.closes.length > 1);
}
