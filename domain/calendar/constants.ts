import type { CalendarEvent } from '@/types/signal';

export type CalendarEventTypeKey = CalendarEvent['type'];

/** 캘린더 필터 UI·저장 순서 */
export const CALENDAR_EVENT_TYPE_ORDER: CalendarEventTypeKey[] = [
  'macro',
  'fed',
  'fomc',
  'earnings',
  'holiday',
];

/** 실적 제외 — 월/일 조회 시 타입별 limit 경쟁 없이 전체 유지 */
export const CALENDAR_NON_EARNINGS_TYPES = CALENDAR_EVENT_TYPE_ORDER.filter(
  (type) => type !== 'earnings',
) as Exclude<CalendarEventTypeKey, 'earnings'>[];
