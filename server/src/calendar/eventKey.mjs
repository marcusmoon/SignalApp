import {
  DEFAULT_CALENDAR_EVENT_CODE_MAPPINGS,
  normalizeCalendarCountry,
  normalizeCalendarEventType,
  slugText,
} from './eventCodes.mjs';

export function stableHash(value) {
  const s = String(value || '').trim();
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

function ymdFromEvent(event) {
  const date = String(event?.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const eventAt = String(event?.eventAt || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(eventAt)) return eventAt.slice(0, 10);
  return '';
}

function normalizeMappings(mappings) {
  const rows = Array.isArray(mappings) && mappings.length > 0 ? mappings : DEFAULT_CALENDAR_EVENT_CODE_MAPPINGS;
  return rows
    .map((row) => ({
      eventType: normalizeCalendarEventType(row.eventType || row.event_type),
      code: slugText(row.code),
      matchType: String(row.matchType || row.match_type || 'contains').trim().toLowerCase(),
      pattern: String(row.pattern || '').trim(),
      priority: Number(row.priority) || 1000,
      enabled: row.enabled !== false,
    }))
    .filter((row) => row.enabled && row.eventType && row.code && row.pattern)
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

export function matchCalendarEventCode(event, mappings) {
  const type = normalizeCalendarEventType(event?.type || event?.eventType);
  const title = String(event?.title || '').trim();
  const titleSlug = slugText(title);
  if (!type || !title) return null;
  for (const row of normalizeMappings(mappings)) {
    if (row.eventType !== type) continue;
    if (row.matchType === 'exact' && title.toLowerCase() === row.pattern.toLowerCase()) return row.code;
    if (row.matchType === 'contains' && title.toLowerCase().includes(row.pattern.toLowerCase())) return row.code;
    if (row.matchType === 'slug' && titleSlug.includes(slugText(row.pattern))) return row.code;
    if (row.matchType === 'regex') {
      try {
        if (new RegExp(row.pattern, 'i').test(title)) return row.code;
      } catch {
        // Invalid admin regex should not break calendar ingest.
      }
    }
  }
  return null;
}

export function buildCalendarEventKey(event, mappings) {
  const type = normalizeCalendarEventType(event?.type || event?.eventType);
  const date = ymdFromEvent(event);
  const titleSlug = slugText(event?.title) || 'untitled';
  const symbol = String(event?.symbol || '').trim().toUpperCase();
  const source = slugText(event?.source || event?.provider);
  const sourceEventId = slugText(event?.sourceEventId || event?.providerItemId);

  if (type === 'holiday') return date ? `holiday:${date}` : `holiday:${titleSlug}`;
  if (type === 'earnings' && symbol) return `earnings:${symbol}:${date || 'no-date'}`;

  const mappedCode = matchCalendarEventCode({ ...event, type }, mappings);
  if (type === 'macro') return `macro:${date || 'no-date'}:${mappedCode || titleSlug}`;
  if (type === 'fomc') return `fomc:${date || 'no-date'}:${mappedCode || titleSlug}`;
  if (type === 'fed') {
    const speaker = slugText(event?.speaker) || inferFedSpeaker(titleSlug);
    const timeOrCode = slugText(event?.timeLabel) || mappedCode || titleSlug;
    return `fed:${date || 'no-date'}:${speaker}:${timeOrCode}`;
  }

  if (source && sourceEventId) return `source:${source}:${sourceEventId}`;
  return `${type || 'event'}:${date || 'no-date'}:${titleSlug}`;
}

function inferFedSpeaker(titleSlug) {
  for (const name of ['powell', 'waller', 'barkin', 'williams', 'goolsbee', 'logan', 'daly', 'bowman', 'cook']) {
    if (titleSlug.includes(name)) return name;
  }
  return 'unknown';
}

export function normalizeCalendarEventForStorage(event, mappings = []) {
  const type = normalizeCalendarEventType(event?.type || event?.eventType);
  const country = normalizeCalendarCountry(event?.country);
  const date = ymdFromEvent(event);
  const eventKey = buildCalendarEventKey({ ...event, type, country, date }, mappings);
  const source = String(event?.source || event?.provider || 'manual').trim() || 'manual';
  const sourceEventId = String(event?.sourceEventId || event?.providerItemId || '').trim();
  const id = `calendar-${country.toLowerCase()}-${type}-${stableHash(eventKey)}`;
  return {
    ...event,
    id,
    country,
    eventKey,
    type,
    date: date || null,
    provider: String(event?.provider || source || 'manual').trim() || 'manual',
    source,
    sourceEventId: sourceEventId || null,
    providerItemId: String(event?.providerItemId || sourceEventId || id).trim() || id,
    title: String(event?.title || '').trim(),
  };
}
