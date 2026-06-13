import { aggregateBacktests, backtestInstrument } from '../../quant/backtest.mjs';
import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  paginatedSqlRows,
  payloadFromRow,
  safeLimit,
} from './publicHelpers.mjs';
import { barsForSeries } from './priceSeriesRepository.mjs';

export async function queryPublicQuantSignalRows(options = {}) {
  const symbols = cleanText(options.symbols)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const requested = new Set(symbols);
  const limit = cleanText(options.limit) ? safeLimit(options.limit, 10, 100) : 10;
  const result = requested.size > 0
    ? await queryKysely(
        `
          WITH requested(symbol, ord) AS (
            SELECT * FROM unnest($1::text[]) WITH ORDINALITY
          ),
          best AS (
            SELECT DISTINCT ON (r.symbol) r.symbol AS requested_symbol, r.ord, q.payload
            FROM requested r
            JOIN quant_signal_items q ON upper(COALESCE(q.symbol, '')) = r.symbol
            ORDER BY r.symbol, q.generated_date DESC NULLS LAST, q.generated_at DESC NULLS LAST, q.score DESC NULLS LAST
          )
          SELECT payload
          FROM best
          ORDER BY ord ASC
          LIMIT $2
        `,
        [symbols, limit],
      )
    : await queryKysely(
        `
          SELECT payload
          FROM quant_signal_items
          ORDER BY generated_date DESC NULLS LAST, score DESC NULLS LAST, position ASC
          LIMIT $1
        `,
        [limit],
      );
  return result.rows.map(payloadFromRow).filter(Boolean);
}

export async function queryPublicQuantBacktestResult(options = {}) {
  const symbols = new Set(
    cleanText(options.symbols)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
  const params = [];
  const where = [];
  if (symbols.size > 0) {
    params.push([...symbols]);
    where.push(`upper(symbol) = ANY($${params.length}::text[])`);
  }
  const result = await queryKysely(
    `
      SELECT payload
      FROM price_series
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY position ASC
      LIMIT 50
    `,
    params,
  );
  const rows = result.rows
    .map(payloadFromRow)
    .filter(Boolean)
    .slice(0, 50)
    .map((series) =>
      backtestInstrument({
        instrument: series,
        bars: barsForSeries(series),
        horizon: Number(options.horizon) || 20,
        warmup: Number(options.warmup) || 80,
        step: Number(options.step) || 1,
      }),
    )
    .filter(Boolean);
  return { rows, summary: aggregateBacktests(rows) };
}

export async function queryPublicQuantSignalHistoryRows(options = {}) {
  const { limit, offset } = pageOptions(options, 60);
  const params = [];
  const where = [];
  const symbol = cleanText(options.symbol).toUpperCase();
  if (symbol) {
    params.push(symbol);
    where.push(`upper(symbol) = $${params.length}`);
  }
  if (options.from) {
    params.push(cleanText(options.from));
    where.push(`generated_date >= $${params.length}::date`);
  }
  if (options.to) {
    params.push(cleanText(options.to));
    where.push(`generated_date <= $${params.length}::date`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM quant_signal_items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY generated_at DESC NULLS LAST, generated_date DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  return paginatedSqlRows(
    result.rows.map((row) => ({ ...row, item: payloadFromRow(row) })),
    { limit, offset },
  );
}
