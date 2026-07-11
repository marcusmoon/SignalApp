import type { AppLocale } from '@/locales/messages';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocalYmd(): string {
  return toYmd(new Date());
}

export function parseLocalYmd(ymd: string): Date {
  const [year, month, day] = String(ymd || '').split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
}

export function monthPartsFromYmd(ymd: string): { year: number; month: number } {
  const date = parseLocalYmd(ymd);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftLocalYmd(ymd: string, days: number): string {
  return toYmd(addDays(parseLocalYmd(ymd), days));
}

export function localeTagForAppLocale(locale: AppLocale): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'ja') return 'ja-JP';
  return 'ko-KR';
}

export function formatLocalYmdLabel(
  ymd: string,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(localeTagForAppLocale(locale), options).format(parseLocalYmd(ymd));
  } catch {
    return ymd;
  }
}

export function formatLocalInstantDate(
  iso: string | null | undefined,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat(localeTagForAppLocale(locale), options).format(date);
}

export function formatInstantLabel(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  const loc = localeTagForAppLocale(locale);
  const datePart = new Intl.DateTimeFormat(loc, { month: 'numeric', day: 'numeric' }).format(date);
  const timePart = new Intl.DateTimeFormat(loc, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${datePart} ${timePart}`;
}

/** 24시간 초과 시 로컬 날짜 (올해는 월·일, 이전 연도는 연도 포함) */
export function formatPastDateLabel(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return String(iso).slice(0, 10);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: 'numeric', day: 'numeric' }
      : { year: 'numeric', month: 'numeric', day: 'numeric' };
  return formatLocalInstantDate(iso, locale, opts);
}

/** 피드·흐름 카드용: 24시간 이내 상대 시각, 이후 날짜 */
export function formatFeedItemTimeLabel(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return '—';
  return formatRelativeFromIso(iso, locale);
}

/** 속보·타임라인 행: 상대 시각 | 절대 시각 */
export function formatNewsTimelineTimeLabel(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  const rel = formatRelativeFromIso(iso, locale);
  const loc = localeTagForAppLocale(locale);
  const abs = new Intl.DateTimeFormat(loc, {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: locale === 'en',
  }).format(date);
  return `${rel} | ${abs}`;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function earningsHourSlot(hour: string | null | undefined): { hour: number; minute: number } | null {
  const text = String(hour || '').trim().toLowerCase();
  if (text === 'bmo' || text === 'before market open') return { hour: 9, minute: 0 };
  if (text === 'amc' || text === 'after market close') return { hour: 16, minute: 0 };
  if (text === 'dmh' || text === 'during market hour') return { hour: 12, minute: 0 };
  return null;
}

function localYmdFromZonedWallClock(
  dateYmd: string,
  hour: number,
  minute: number,
  timeZone: string,
): string | null {
  const [year, month, day] = dateYmd.split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
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
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    return toYmd(new Date(utcGuess.getTime() - (shownAsUtc - targetAsUtc)));
  } catch {
    return null;
  }
}

/** Calendar grid / day list: device-local YMD from eventAt or US earnings hour when available. Holidays always use market event_date. */
export function calendarEventDisplayYmd(ev: {
  date?: string | null;
  eventAt?: string | null;
  earningsHour?: string | null;
  time?: string | null;
  timezone?: string | null;
  country?: string | null;
  type?: string;
}): string {
  if (ev.type === 'holiday') {
    return String(ev.date || '').slice(0, 10);
  }
  const iso = ev.eventAt?.trim();
  if (iso) {
    const date = new Date(iso);
    if (Number.isFinite(date.getTime())) return toYmd(date);
  }
  const marketDate = String(ev.date || '').slice(0, 10);
  const slot = earningsHourSlot(ev.earningsHour || ev.time);
  const timezone =
    ev.timezone ||
    (ev.country === 'KR' ? 'Asia/Seoul' : ev.country === 'US' ? 'America/New_York' : '');
  if (slot && /^\d{4}-\d{2}-\d{2}$/.test(marketDate) && timezone) {
    const localYmd = localYmdFromZonedWallClock(marketDate, slot.hour, slot.minute, timezone);
    if (localYmd) return localYmd;
  }
  return marketDate;
}

export function calendarEventInLocalYmdRange(
  ev: { date?: string; eventAt?: string | null },
  fromYmd: string,
  toYmdValue: string,
): boolean {
  const ymd = calendarEventDisplayYmd(ev);
  if (!ymd) return false;
  return ymd >= fromYmd && ymd <= toYmdValue;
}

export function utcRangeForLocalYmd(ymd: string): { from: string; to: string } {
  const [year, month, day] = String(ymd || '').split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString(),
    };
  }
  return {
    from: new Date(year, month - 1, day, 0, 0, 0, 0).toISOString(),
    to: new Date(year, month - 1, day, 23, 59, 59, 999).toISOString(),
  };
}

/** Unix seconds → relative label (locale-aware; uses same rules as `formatRelativeTime`) */
export function formatRelativeFromUnix(sec: number, locale: AppLocale): string {
  const ms = sec * 1000;
  if (!Number.isFinite(ms)) return '—';
  return formatRelativeTime(new Date(ms).toISOString(), locale);
}

/** ISO date string → relative (locale-aware) */
export function formatRelativeFromIso(iso: string, locale: AppLocale): string {
  return formatRelativeTime(iso, locale);
}

/** ISO → relative time (locale-aware, Intl + 폴백) */
export function formatRelativeTime(iso: string, locale: AppLocale): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const rawSec = Math.round((Date.now() - then) / 1000);
  if (!Number.isFinite(rawSec)) return '—';
  const diffSec = Math.max(0, rawSec);

  const loc = locale === 'ja' ? 'ja' : locale === 'en' ? 'en' : 'ko';

  const fallback = (): string => {
    if (diffSec < 60) {
      if (locale === 'ko') return `${diffSec}초 전`;
      if (locale === 'ja') return `${diffSec}秒前`;
      return diffSec === 0 ? 'just now' : `${diffSec}s ago`;
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      if (locale === 'ko') return `${diffMin}분 전`;
      if (locale === 'ja') return `${diffMin}分前`;
      return `${diffMin} min ago`;
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      if (locale === 'ko') return `${diffHour}시간 전`;
      if (locale === 'ja') return `${diffHour}時間前`;
      return `${diffHour} hr ago`;
    }
    return formatPastDateLabel(iso, locale);
  };

  try {
    const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-diffSec, 'second');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return rtf.format(-diffHour, 'hour');
    return formatPastDateLabel(iso, locale);
  } catch {
    return fallback();
  }
}
