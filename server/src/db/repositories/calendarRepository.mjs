import { queryKysely } from '../kysely/client.mjs';
import { cleanText, safeLimit, safeOffset } from './publicHelpers.mjs';

function rowToPublicEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider || 'manual',
    providerItemId: row.provider_item_id || row.id,
    eventKey: row.event_key || null,
    type: row.event_type || null,
    title: row.title || '',
    country: row.country || null,
    symbol: row.symbol || null,
    eventAt: row.event_at || null,
    date: row.event_date ? String(row.event_date).slice(0, 10) : null,
    timeLabel: row.time_label || '',
    timezone: row.timezone || null,
    impact: row.impact || null,
    importance: row.importance || null,
    actual: row.actual ?? null,
    estimate: row.estimate ?? null,
    previous: row.previous ?? null,
    unit: row.unit || null,
    fiscalYear: row.fiscal_year ?? null,
    fiscalQuarter: row.fiscal_quarter ?? null,
    earningsHour: row.earnings_hour || null,
    companyName: row.company_name || null,
    source: row.source || null,
    sourceEventId: row.source_event_id || null,
    url: row.url || null,
    fetchedAt: row.updated_at || null,
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
  const country = cleanText(options.country).toUpperCase();
  if (country) {
    params.push(country);
    where.push(`upper(COALESCE(country, '')) = $${params.length}`);
  }
  const symbol = cleanText(options.symbol).toUpperCase();
  if (symbol) {
    params.push(symbol);
    where.push(`(upper(COALESCE(symbol, '')) = $${params.length} OR upper(COALESCE(title, '')) LIKE '%' || $${params.length} || '%')`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(title, '')) LIKE $${params.length}
      OR lower(COALESCE(country, '')) LIKE $${params.length}
      OR lower(COALESCE(symbol, '')) LIKE $${params.length}
      OR lower(COALESCE(event_type, '')) LIKE $${params.length}
    )`);
  }

  params.push(limit, offset);
  const result = await queryKysely(
    `
      SELECT
        id, event_type, event_date::text, event_at, event_key,
        country, symbol, title, provider, provider_item_id,
        time_label, timezone, company_name, source, source_event_id,
        impact, importance, actual, estimate, previous, unit,
        fiscal_year, fiscal_quarter, earnings_hour, url, updated_at
      FROM calendar_events
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY event_date ASC NULLS LAST, title
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  return result.rows.map(rowToPublicEvent).filter(Boolean);
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
  const country = cleanText(options.country).toUpperCase();
  if (country) {
    params.push(country);
    where.push(`upper(COALESCE(country, '')) = $${params.length}`);
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

export async function deleteCalendarRowById(id) {
  const clean = cleanText(id);
  if (!clean) return 0;
  const result = await queryKysely(
    `DELETE FROM calendar_events WHERE id = $1`,
    [clean],
  );
  return result.rowCount || 0;
}

export async function deleteCalendarRowsByIds(ids) {
  const clean = ids.map(cleanText).filter(Boolean);
  if (clean.length === 0) return 0;
  const placeholders = clean.map((_, i) => `$${i + 1}`).join(', ');
  const result = await queryKysely(
    `DELETE FROM calendar_events WHERE id IN (${placeholders})`,
    clean,
  );
  return result.rowCount || 0;
}

/**
 * Find duplicates by (country, event_type, event_key) — same as the unique constraint.
 * The unique index already prevents true duplicates; this targets any leftover legacy rows
 * that pre-date the constraint. Keeps oldest (smallest id), prefers provider='manual'.
 */
export async function findDuplicateCalendarIds() {
  const result = await queryKysely(
    `
      WITH grouped AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY country, event_type, event_key
            ORDER BY
              CASE WHEN COALESCE(provider, '') = 'manual' THEN 0 ELSE 1 END ASC,
              id ASC
          ) AS rn
        FROM calendar_events
        WHERE event_key IS NOT NULL AND event_key <> ''
      )
      SELECT id FROM grouped WHERE rn > 1
    `,
    [],
  );
  return result.rows.map((r) => r.id);
}
