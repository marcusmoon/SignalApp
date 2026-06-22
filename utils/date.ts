import type { AppLocale } from '@/locales/messages';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
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
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) {
      if (locale === 'ko') return `${diffDay}일 전`;
      if (locale === 'ja') return `${diffDay}日前`;
      return `${diffDay} days ago`;
    }
    const diffWeek = Math.floor(diffDay / 7);
    if (locale === 'ko') return `${diffWeek}주 전`;
    if (locale === 'ja') return `${diffWeek}週間前`;
    return `${diffWeek} wk ago`;
  };

  try {
    const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-diffSec, 'second');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return rtf.format(-diffHour, 'hour');
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return rtf.format(-diffDay, 'day');
    const diffWeek = Math.floor(diffDay / 7);
    return rtf.format(-diffWeek, 'week');
  } catch {
    return fallback();
  }
}
