import { textForVars } from './i18n.js';

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function ymd(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Admin UI language (ko/en/ja) → Intl locale tag for date formatting. */
export function adminUiLocale() {
  const lang = localStorage.getItem('signalAdminLanguage') || 'ko';
  if (lang === 'en') return 'en-US';
  if (lang === 'ja') return 'ja-JP';
  return 'ko-KR';
}

function localeToTimeZone(locale) {
  if (locale === 'en-US') return 'America/New_York';
  if (locale === 'ja-JP') return 'Asia/Tokyo';
  return 'Asia/Seoul';
}

/** Selected admin timezone (IANA). Defaults to UTC to match server-stored instants. */
export function readAdminTimeZone() {
  const raw = String(localStorage.getItem('signalAdminTimeBasis') || '').trim();
  if (raw.includes('|')) {
    const tz = raw.split('|')[1]?.trim();
    if (tz) return tz;
  }
  if (raw) return raw;
  const legacyMode = localStorage.getItem('signalAdminTimeMode');
  if (legacyMode === 'utc') return 'UTC';
  const legacyLocale = localStorage.getItem('signalAdminLocale');
  if (legacyLocale) return localeToTimeZone(legacyLocale);
  return 'UTC';
}

export function timeBasis() {
  return { locale: adminUiLocale(), timeZone: readAdminTimeZone() };
}

export function adminLocale() {
  return adminUiLocale();
}

export function timeMode() {
  return readAdminTimeZone() === 'UTC' ? 'utc' : 'local';
}

/** Calendar YMD in the admin-selected timezone (for date pickers and presets). */
export function ymdInAdminTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const { timeZone } = timeBasis();
  if (timeZone === 'UTC') return d.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.year && byType.month && byType.day) {
      return `${byType.year}-${byType.month}-${byType.day}`;
    }
  } catch {
    // Fall through to browser-local date.
  }
  return ymd(d);
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  const { locale, timeZone } = timeBasis();
  const formatted = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
  return timeZone === 'UTC' ? `${formatted} UTC` : formatted;
}

function zonedTimeToUtc(ymdValue, { hour = 0, minute = 0, second = 0, millisecond = 0 } = {}) {
  const [year, month, day] = String(ymdValue || '').split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const { timeZone } = timeBasis();
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (timeZone === 'UTC') return utcGuess;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
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
      millisecond,
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    return new Date(utcGuess.getTime() - (shownAsUtc - targetAsUtc));
  } catch {
    return new Date(year, month - 1, day, hour, minute, second, millisecond);
  }
}

/** Convert admin date-picker YMD (in selected timezone) to UTC ISO range for API filters. */
export function utcRangeForYmd(ymdValue) {
  const from = zonedTimeToUtc(ymdValue, { hour: 0, minute: 0, second: 0, millisecond: 0 });
  const to = zonedTimeToUtc(ymdValue, { hour: 23, minute: 59, second: 59, millisecond: 999 });
  return {
    from: from ? from.toISOString() : '',
    to: to ? to.toISOString() : '',
  };
}

export function jobIntervalLabel(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 3600) return textForVars('durationMin', { n: Math.round(n / 60) });
  if (n % 86400 === 0) return textForVars('durationDay', { n: Math.round(n / 86400) });
  if (n % 3600 === 0) return textForVars('durationHour', { n: Math.round(n / 3600) });
  return textForVars('durationSec', { n });
}
