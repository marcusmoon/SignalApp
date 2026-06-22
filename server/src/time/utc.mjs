/** UTC-only time helpers for server storage and API filtering. */

export function utcNowIso() {
  return new Date().toISOString();
}

export function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

export function parseToUtcIsoOrNull(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (isDateOnly(text)) return `${text}T00:00:00.000Z`;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/** UTC calendar date (YYYY-MM-DD) from an instant or date-only string. */
export function utcDateKeyFromInstant(value) {
  const iso = parseToUtcIsoOrNull(value);
  return iso ? iso.slice(0, 10) : null;
}

export function utcDateOnlyOrNull(value) {
  const text = String(value || '').trim();
  if (isDateOnly(text)) return text;
  return utcDateKeyFromInstant(text);
}

/** Inclusive UTC range start for API `from` (date-only → start of UTC day). */
export function sqlUtcRangeFrom(value) {
  return parseToUtcIsoOrNull(value);
}

/** Inclusive UTC range end for API `to` (date-only → end of UTC day). */
export function sqlUtcRangeTo(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (isDateOnly(text)) return `${text}T23:59:59.999Z`;
  return parseToUtcIsoOrNull(text);
}

/** Calendar YMD in a named IANA timezone (for external APIs such as DART). */
export function ymdInTimezone(value, timeZone) {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  const tz = String(timeZone || '').trim();
  if (!tz) return instant.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.year && byType.month && byType.day) {
      return `${byType.year}-${byType.month}-${byType.day}`;
    }
  } catch {
    // Fall back to UTC date key.
  }
  return instant.toISOString().slice(0, 10);
}

/** Compact YYYYMMDD in a named timezone (DART API). */
export function compactYmdInTimezone(value, timeZone) {
  const ymd = ymdInTimezone(value, timeZone);
  if (!ymd) return null;
  return ymd.replace(/-/g, '');
}
