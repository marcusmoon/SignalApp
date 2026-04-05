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

/** Unix seconds → relative label (ko) */
export function formatRelativeFromUnix(sec: number): string {
  const t = Date.now() - sec * 1000;
  const m = Math.floor(t / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return `${Math.floor(d / 7)}주 전`;
}

import type { AppLocale } from '@/locales/messages';

/** ISO → relative time (locale-aware, Intl + 폴백) */
export function formatRelativeTime(iso: string, locale: AppLocale): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const rawSec = Math.round((Date.now() - then) / 1000);
  if (!Number.isFinite(rawSec)) return '—';
  const diffSec = Math.max(0, rawSec);

  const loc = locale === 'ja' ? 'ja' : locale === 'en' ? 'en' : 'ko';

  /** Intl 미구현·NaN 등으로 실패 시 사용 */
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

/** ISO date string → relative */
export function formatRelativeFromIso(iso: string): string {
  const t = Date.now() - new Date(iso).getTime();
  const m = Math.floor(t / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d === 1) return '어제';
  if (d < 7) return `${d}일 전`;
  return `${Math.floor(d / 7)}주 전`;
}
