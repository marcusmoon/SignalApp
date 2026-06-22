import {
  DEFAULT_CALENDAR_EVENT_CODE_MAPPINGS,
  normalizeCalendarCountry,
  normalizeCalendarEventType,
  slugText,
} from './eventCodes.mjs';
import { parseToUtcIsoOrNull } from '../time/utc.mjs';

export function stableHash(value) {
  const s = String(value || '').trim();
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

function normalizeCalendarTimezone(value, country) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  if (upper === 'ET' || upper === 'EST' || upper === 'EDT' || raw === 'America/New_York') return 'America/New_York';
  if (upper === 'KST' || upper === 'KR' || upper === 'KOREA' || raw === 'Asia/Seoul') return 'Asia/Seoul';
  if (upper === 'UTC' || upper === 'GMT' || raw === 'Etc/UTC') return 'UTC';
  if (raw.includes('/')) return raw;
  if (country === 'US') return 'America/New_York';
  if (country === 'KR') return 'Asia/Seoul';
  return raw || null;
}

function timezoneLabel(timezone) {
  if (timezone === 'America/New_York') return 'ET';
  if (timezone === 'Asia/Seoul') return 'KST';
  if (timezone === 'UTC') return 'UTC';
  return '';
}

function ymdInTimezone(value, timezone) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  if (!timezone || timezone === 'UTC') return date.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.year && byType.month && byType.day) return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    // Fall through to UTC date.
  }
  return date.toISOString().slice(0, 10);
}

function ymdFromEventInTimezone(event, timezone) {
  const date = String(event?.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const eventAt = String(event?.eventAt || '').trim();
  if (eventAt) return ymdInTimezone(eventAt, timezone);
  return '';
}

function parseTimeLabel(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const twelve = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    const meridiem = twelve[3].toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!twentyFour) return null;
  return { hour: Number(twentyFour[1]), minute: Number(twentyFour[2]) };
}

function zonedTimeToUtcIso(dateYmd, timeLabel, timezone) {
  const parsedTime = parseTimeLabel(timeLabel);
  if (!dateYmd || !parsedTime || !timezone) return null;
  const [year, month, day] = String(dateYmd || '').split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (timezone === 'UTC') {
    return new Date(Date.UTC(year, month - 1, day, parsedTime.hour, parsedTime.minute, 0, 0)).toISOString();
  }
  const utcGuess = new Date(Date.UTC(year, month - 1, day, parsedTime.hour, parsedTime.minute, 0, 0));
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(utcGuess);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const shownAsUtc = Date.UTC(
      Number(byType.year),
      Number(byType.month) - 1,
      Number(byType.day),
      Number(byType.hour),
      Number(byType.minute),
      Number(byType.second),
      0,
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, parsedTime.hour, parsedTime.minute, 0, 0);
    return new Date(utcGuess.getTime() - (shownAsUtc - targetAsUtc)).toISOString();
  } catch {
    return null;
  }
}

function earningsHourToTimeLabel(hour) {
  const text = String(hour || '').trim().toLowerCase();
  if (text === 'bmo' || text === 'before market open') return '9:00 AM';
  if (text === 'amc' || text === 'after market close') return '4:00 PM';
  if (text === 'dmh' || text === 'during market hour') return '12:00 PM';
  return null;
}

/** Partial close only (Finnhub: tradingHour set when market is not fully closed). */
function holidayTradingHourToTimeLabel(tradingHour) {
  const text = String(tradingHour || '').trim();
  if (!text) return null;
  const ranged = text.match(/(\d{1,2}):?(\d{2})\s*[-–]\s*(\d{1,2}):?(\d{2})/);
  if (ranged) {
    const hour = Number(ranged[3]);
    const minute = Number(ranged[4]);
    if (Number.isFinite(hour) && Number.isFinite(minute) && hour <= 23 && minute <= 59) {
      return `${hour}:${String(minute).padStart(2, '0')}`;
    }
  }
  const compact = text.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (compact) {
    const close = compact[2];
    const hour = Number(close.slice(0, 2));
    const minute = Number(close.slice(2, 4));
    if (Number.isFinite(hour) && Number.isFinite(minute) && hour <= 23 && minute <= 59) {
      return `${hour}:${String(minute).padStart(2, '0')}`;
    }
  }
  return parseTimeLabel(text) ? text : null;
}

function resolveEventTimeLabel(event) {
  const type = normalizeCalendarEventType(event?.type || event?.eventType);
  if (type === 'holiday') {
    return holidayTradingHourToTimeLabel(event?.timeLabel) || null;
  }
  const timeLabel = String(event?.timeLabel || '').trim();
  if (timeLabel && parseTimeLabel(timeLabel)) return timeLabel;
  return earningsHourToTimeLabel(event?.earningsHour) || timeLabel || null;
}

/** Provider raw fields (e.g. Finnhub economic `time`) before wall-clock fallback. */
function eventAtFromProviderPayload(event, timezone) {
  const raw = event?.rawPayload;
  if (!raw || typeof raw !== 'object') return null;
  const time = String(raw.time || raw.dateTime || raw.datetime || '').trim();
  if (!time) return null;
  if (time.includes('T')) {
    const iso = parseToUtcIsoOrNull(time);
    if (iso) return iso;
  }
  const dated = time.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/);
  if (dated && timezone) {
    const clock = `${dated[2]}:${dated[3]}`;
    return zonedTimeToUtcIso(dated[1], clock, timezone);
  }
  return null;
}

/**
 * Resolve UTC instant for storage. Priority (job ingest / upsert):
 * 1. explicit eventAt
 * 2. provider raw datetime (Finnhub economic `time`, etc.)
 * 3. event_date + parsed timeLabel
 * 4. event_date + earningsHour slot (amc/bmo/dmh)
 * Holidays: full closure → null; partial close → tradingHour close time (e.g. 0930-1300).
 */
function normalizeEventAt(event, date, timezone) {
  const eventAt = String(event?.eventAt || '').trim();
  if (eventAt) {
    const parsed = new Date(eventAt);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  const fromProvider = eventAtFromProviderPayload(event, timezone);
  if (fromProvider) return fromProvider;
  return zonedTimeToUtcIso(date, resolveEventTimeLabel(event), timezone);
}

function normalizeTimeLabel(value, timezone) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!parseTimeLabel(text)) return text;
  const label = timezoneLabel(timezone);
  if (!label) return text;
  return new RegExp(`\\b${label}\\b`, 'i').test(text) ? text : `${text} ${label}`;
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
  const country = normalizeCalendarCountry(event?.country);
  const timezone = normalizeCalendarTimezone(event?.timezone, country);
  const date = ymdFromEventInTimezone(event, timezone);
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
  const timezone = normalizeCalendarTimezone(event?.timezone, country);
  const date = ymdFromEventInTimezone(event, timezone);
  const eventKey = buildCalendarEventKey({ ...event, type, country, date }, mappings);
  const source = String(event?.source || event?.provider || 'manual').trim() || 'manual';
  const sourceEventId = String(event?.sourceEventId || event?.providerItemId || '').trim();
  const id = `calendar-${country.toLowerCase()}-${type}-${stableHash(eventKey)}`;
  const eventAt = normalizeEventAt(event, date, timezone);
  return {
    ...event,
    id,
    country,
    eventKey,
    type,
    date: date || null,
    eventAt,
    timezone,
    timeLabel: normalizeTimeLabel(event?.timeLabel, timezone),
    provider: String(event?.provider || source || 'manual').trim() || 'manual',
    source,
    sourceEventId: sourceEventId || null,
    providerItemId: String(event?.providerItemId || sourceEventId || id).trim() || id,
    title: String(event?.title || '').trim(),
  };
}
