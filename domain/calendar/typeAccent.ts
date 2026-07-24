import type { AppTheme } from '@/constants/theme';
import type { CalendarEventTypeKey } from '@/domain/calendar/constants';

/** 캘린더 타입별 스캔 색 — 카드 rail·뱃지·필터 칩 공통 */
export function calendarTypeAccent(theme: AppTheme, type: CalendarEventTypeKey): string {
  if (type === 'earnings') return theme.green;
  if (type === 'macro') return theme.accentBlue;
  if (type === 'fed') return theme.accentOrange;
  if (type === 'fomc') return theme.danger;
  return theme.textMuted;
}

export function calendarTypeSoftFill(theme: AppTheme, type: CalendarEventTypeKey): string {
  const accent = calendarTypeAccent(theme, type);
  if (type === 'holiday') return theme.bgElevated;
  return `${accent}18`;
}
