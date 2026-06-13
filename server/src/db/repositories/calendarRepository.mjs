import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  payloadFromRow,
  safeLimit,
  safeOffset,
} from './publicHelpers.mjs';

function publicCalendarEvent(item) {
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    type: item.type,
    title: item.title,
    country: item.country || null,
    symbol: item.symbol || null,
    eventAt: item.eventAt || null,
    date: item.date || null,
    timeLabel: item.timeLabel || '',
    impact: item.impact || null,
    actual: item.actual ?? null,
    estimate: item.estimate ?? null,
    previous: item.previous ?? null,
    unit: item.unit || null,
    fiscalYear: item.fiscalYear ?? null,
    fiscalQuarter: item.fiscalQuarter ?? null,
    earningsHour: item.earningsHour || null,
    fetchedAt: item.fetchedAt,
  };
}

export async function queryPublicCalendarRows(options = {}) {
  const limit = cleanText(options.limit) ? safeLimit(options.limit, 200, 1000) : 200;
  const offset = safeOffset(options.offset);
  const params = [];
  const where = [];
  const from = cleanText(options.from);
  if (from) {
    params.push(from);
    where.push(`(event_date IS NULL OR event_date >= $${params.length}::date)`);
  }
  const to = cleanText(options.to);
  if (to) {
    params.push(to);
    where.push(`(event_date IS NULL OR event_date <= $${params.length}::date)`);
  }
  const type = cleanText(options.type);
  if (type) {
    params.push(type);
    where.push(`event_type = $${params.length}`);
  }
  const symbol = cleanText(options.symbol).toUpperCase();
  if (symbol) {
    params.push(symbol);
    where.push(`(upper(COALESCE(symbol, '')) = $${params.length} OR upper(COALESCE(payload->>'title', '')) LIKE '%' || $${params.length} || '%')`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(payload->>'title', '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'country', '')) LIKE $${params.length}
      OR lower(COALESCE(symbol, '')) LIKE $${params.length}
      OR lower(COALESCE(event_type, '')) LIKE $${params.length}
    )`);
  }
  params.push(limit, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM calendar_events
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY event_date ASC NULLS LAST, COALESCE(payload->>'title', '')
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  return result.rows.map(payloadFromRow).filter(Boolean).map(publicCalendarEvent);
}

export async function queryPublicCalendarDateSummaryRows(options = {}) {
  const params = [];
  const where = ['event_date IS NOT NULL'];
  const from = cleanText(options.from);
  if (from) {
    params.push(from);
    where.push(`event_date >= $${params.length}::date`);
  }
  const to = cleanText(options.to);
  if (to) {
    params.push(to);
    where.push(`event_date <= $${params.length}::date`);
  }
  const type = cleanText(options.type);
  if (type) {
    params.push(type);
    where.push(`event_type = $${params.length}`);
  }
  const result = await queryKysely(
    `
      SELECT event_date::text AS date, COALESCE(event_type, 'unknown') AS type, COUNT(*)::int AS count
      FROM calendar_events
      WHERE ${where.join(' AND ')}
      GROUP BY event_date, COALESCE(event_type, 'unknown')
      ORDER BY event_date ASC
    `,
    params,
  );
  const byDate = new Map();
  for (const row of result.rows) {
    const date = cleanText(row.date).slice(0, 10);
    if (!date) continue;
    const prev = byDate.get(date) || { date, total: 0, counts: {} };
    const count = Number(row.count) || 0;
    prev.total += count;
    prev.counts[row.type || 'unknown'] = count;
    byDate.set(date, prev);
  }
  return [...byDate.values()];
}
