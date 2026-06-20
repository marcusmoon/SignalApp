import { queryKysely } from '../kysely/client.mjs';
import { cleanText } from './publicHelpers.mjs';
import { stableHash } from '../../calendar/eventKey.mjs';
import { normalizeCalendarEventType, slugText } from '../../calendar/eventCodes.mjs';

function booleanFrom(value, fallback = true) {
  if (value === true || value === false) return value;
  const text = cleanText(value).toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes') return true;
  if (text === 'false' || text === '0' || text === 'no') return false;
  return fallback;
}

function mappingId(row) {
  const seed = [
    normalizeCalendarEventType(row.eventType || row.event_type),
    slugText(row.code),
    cleanText(row.locale || 'default').toLowerCase(),
    cleanText(row.matchType || row.match_type || 'contains').toLowerCase(),
    cleanText(row.pattern).toLowerCase(),
  ].join(':');
  return `calendar-code-${stableHash(seed)}`;
}

function toApiRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    code: row.code,
    label: row.label,
    locale: row.locale,
    matchType: row.match_type,
    pattern: row.pattern,
    priority: Number(row.priority) || 1000,
    enabled: row.enabled !== false,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function listCalendarEventCodeMappingRows(options = {}) {
  const params = [];
  const where = [];
  const eventType = normalizeCalendarEventType(options.eventType);
  if (cleanText(options.eventType)) {
    params.push(eventType);
    where.push(`event_type = $${params.length}`);
  }
  if (options.enabled != null) {
    params.push(booleanFrom(options.enabled));
    where.push(`enabled = $${params.length}`);
  }
  const result = await queryKysely(
    `
      SELECT *
      FROM calendar_event_code_mappings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY event_type ASC, priority ASC, code ASC, label ASC
    `,
    params,
  );
  return result.rows.map(toApiRow).filter(Boolean);
}

export async function listCalendarEventCodeMappingPayloads(options = {}) {
  return listCalendarEventCodeMappingRows(options);
}

export async function upsertCalendarEventCodeMappingRow(input = {}) {
  const now = new Date().toISOString();
  const row = {
    id: cleanText(input.id) || mappingId(input),
    eventType: normalizeCalendarEventType(input.eventType || input.event_type),
    code: slugText(input.code),
    label: cleanText(input.label),
    locale: cleanText(input.locale || 'default').toLowerCase() || 'default',
    matchType: cleanText(input.matchType || input.match_type || 'contains').toLowerCase() || 'contains',
    pattern: cleanText(input.pattern),
    priority: Number.isFinite(Number(input.priority)) ? Math.floor(Number(input.priority)) : 1000,
    enabled: booleanFrom(input.enabled, true),
  };
  if (!row.eventType || !row.code || !row.label || !row.pattern) {
    throw new Error('CALENDAR_MAPPING_REQUIRED_FIELDS');
  }
  if (!['exact', 'contains', 'slug', 'regex'].includes(row.matchType)) {
    throw new Error('CALENDAR_MAPPING_INVALID_MATCH_TYPE');
  }
  const result = await queryKysely(
    `
      INSERT INTO calendar_event_code_mappings (
        id, event_type, code, label, locale, match_type, pattern, priority, enabled, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      ON CONFLICT(id) DO UPDATE SET
        event_type = excluded.event_type,
        code = excluded.code,
        label = excluded.label,
        locale = excluded.locale,
        match_type = excluded.match_type,
        pattern = excluded.pattern,
        priority = excluded.priority,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
      RETURNING *
    `,
    [
      row.id,
      row.eventType,
      row.code,
      row.label,
      row.locale,
      row.matchType,
      row.pattern,
      row.priority,
      row.enabled,
      now,
    ],
  );
  return toApiRow(result.rows[0]);
}

export async function deleteCalendarEventCodeMappingRow(id) {
  const clean = cleanText(id);
  if (!clean) return 0;
  const result = await queryKysely(
    `DELETE FROM calendar_event_code_mappings WHERE id = $1`,
    [clean],
  );
  return Number(result.rowCount) || 0;
}
