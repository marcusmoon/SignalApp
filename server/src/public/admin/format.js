export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function ymd(date) {
  return date.toISOString().slice(0, 10);
}

export function adminLocale() {
  const basis = timeBasis();
  if (basis.locale === 'utc') return 'en-GB';
  return basis.locale;
}

export function timeMode() {
  return timeBasis().timeZone === 'UTC' ? 'utc' : 'local';
}

export function timeBasis() {
  const legacyLocale = localStorage.getItem('signalAdminLocale');
  const legacyMode = localStorage.getItem('signalAdminTimeMode');
  const raw =
    localStorage.getItem('signalAdminTimeBasis') ||
    (legacyMode === 'utc' ? 'utc|UTC' : legacyLocale ? `${legacyLocale}|${localeToTimeZone(legacyLocale)}` : 'ko-KR|Asia/Seoul');
  const [locale = 'ko-KR', timeZone = 'Asia/Seoul'] = raw.split('|');
  return { locale, timeZone };
}

function localeToTimeZone(locale) {
  if (locale === 'en-US') return 'America/New_York';
  if (locale === 'ja-JP') return 'Asia/Tokyo';
  return 'Asia/Seoul';
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  const basis = timeBasis();
  // Remove timezone suffixes like "GMT+9" / "UTC" from UI output.
  if (basis.timeZone === 'UTC') return date.toISOString().replace('T', ' ').replace('.000Z', '');
  return new Intl.DateTimeFormat(adminLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: basis.timeZone,
    timeZoneName: undefined,
  }).format(date);
}

export function jobIntervalLabel(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 3600) return `${Math.round(n / 60)}분`;
  if (n % 86400 === 0) return `${Math.round(n / 86400)}일`;
  if (n % 3600 === 0) return `${Math.round(n / 3600)}시간`;
  return `${n}초`;
}
