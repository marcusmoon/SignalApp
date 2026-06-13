import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  paginatedSqlRows,
  payloadFromRow,
} from './publicHelpers.mjs';

function publicConcall(item) {
  return {
    id: item.id,
    provider: item.provider,
    symbol: item.symbol,
    title: item.title,
    fiscalYear: item.fiscalYear ?? null,
    fiscalQuarter: item.fiscalQuarter ?? null,
    earningsDate: item.earningsDate || null,
    earningsHour: item.earningsHour || null,
    transcript: item.transcript || '',
    summaryProvider: item.summaryProvider || '',
    fetchedAt: item.fetchedAt,
  };
}

export async function queryPublicConcallRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const params = [];
  const where = [];
  const symbol = cleanText(options.symbol).toUpperCase();
  if (symbol) {
    params.push(symbol);
    where.push(`upper(symbol) = $${params.length}`);
  }
  const year = cleanText(options.year || options.fiscalYear);
  if (year) {
    params.push(Number(year));
    where.push(`fiscal_year = $${params.length}`);
  }
  const quarter = cleanText(options.quarter || options.fiscalQuarter);
  if (quarter) {
    params.push(Number(quarter));
    where.push(`fiscal_quarter = $${params.length}`);
  }
  const from = cleanText(options.from);
  if (from) {
    params.push(from);
    where.push(`(earnings_date IS NULL OR earnings_date >= $${params.length}::date)`);
  }
  const to = cleanText(options.to);
  if (to) {
    params.push(to);
    where.push(`(earnings_date IS NULL OR earnings_date <= $${params.length}::date)`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(symbol, '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'title', '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'summaryProvider', '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'provider', '')) LIKE $${params.length}
    )`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM concall_transcripts
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY earnings_date DESC NULLS LAST, symbol ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const includeTranscript = cleanText(options.includeTranscript) === '1';
  return paginatedSqlRows(
    result.rows.map((row) => {
      const item = payloadFromRow(row);
      if (!item) return { item: null };
      if (includeTranscript) return { item: publicConcall(item) };
      const { transcript, rawPayload, ...rest } = item;
      return { item: publicConcall(rest) };
    }),
    { limit, offset },
  );
}
