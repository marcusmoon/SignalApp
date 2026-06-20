import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  safeLimit,
  safeOffset,
} from './publicHelpers.mjs';

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoOrNull(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function publicCalendarEvent(row) {
  return {
    id: row.id,
    provider: row.provider || row.source || 'manual',
    providerItemId: row.provider_item_id || row.source_event_id || row.id,
    type: row.event_type,
    title: row.title,
    country: row.country || null,
    symbol: row.symbol || null,
    eventAt: isoOrNull(row.event_at),
    date: cleanText(row.event_date).slice(0, 10) || null,
    timeLabel: row.time_label || '',
    impact: row.impact || null,
    actual: numberOrNull(row.actual),
    estimate: numberOrNull(row.estimate),
    previous: numberOrNull(row.previous),
    unit: row.unit || null,
    fiscalYear: row.fiscal_year == null ? null : Number(row.fiscal_year),
    fiscalQuarter: row.fiscal_quarter == null ? null : Number(row.fiscal_quarter),
    earningsHour: row.earnings_hour || null,
    eventKey: row.event_key || null,
    source: row.source || null,
    sourceEventId: row.source_event_id || null,
    timezone: row.timezone || null,
    companyName: row.company_name || null,
    importance: row.importance || null,
    url: row.url || null,
    fetchedAt: isoOrNull(row.updated_at) || isoOrNull(row.created_at) || null,
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
      OR lower(COALESCE(source, '')) LIKE $${params.length}
      OR lower(COALESCE(provider, '')) LIKE $${params.length}
    )`);
  }
  params.push(limit, offset);
  const result = await queryKysely(
    `
      SELECT
        id,
        event_date::text AS event_date,
        event_at,
        event_type,
        symbol,
        country,
        title,
        provider,
        provider_item_id,
        time_label,
        timezone,
        company_name,
        source,
        source_event_id,
        event_key,
        importance,
        impact,
        actual,
        estimate,
        previous,
        unit,
        fiscal_year,
        fiscal_quarter,
        earnings_hour,
        url,
        created_at,
        updated_at
      FROM calendar_events
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY event_date ASC NULLS LAST, event_at ASC NULLS LAST, COALESCE(time_label, ''), COALESCE(title, '')
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  return result.rows.map(publicCalendarEvent);
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
 * Find duplicates: same (country, event_type, event_key).
 * Within each group keep one — prefer manual, then source-backed rows, then latest update.
 * Returns list of ids to delete.
 */
export async function findDuplicateCalendarIds() {
  const result = await queryKysely(
    `
      WITH grouped AS (
        SELECT
          id,
          event_type,
          upper(COALESCE(country, 'GLOBAL')) AS country,
          COALESCE(event_key, '') AS event_key,
          COALESCE(provider, source, '') AS prov,
          COALESCE(source_event_id, provider_item_id, '') AS source_ref,
          ROW_NUMBER() OVER (
            PARTITION BY upper(COALESCE(country, 'GLOBAL')), event_type, COALESCE(event_key, '')
            ORDER BY
              CASE WHEN COALESCE(provider, source, '') = 'manual' THEN 0 ELSE 1 END ASC,
              CASE WHEN COALESCE(source_event_id, provider_item_id, '') <> '' THEN 0 ELSE 1 END ASC,
              updated_at DESC NULLS LAST,
              id ASC
          ) AS rn
        FROM calendar_events
        WHERE event_type IS NOT NULL AND COALESCE(event_key, '') <> ''
      )
      SELECT id FROM grouped WHERE rn > 1
    `,
    [],
  );
  return result.rows.map((r) => r.id);
}
