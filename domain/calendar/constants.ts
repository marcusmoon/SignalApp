import type { CalendarEvent } from '@/types/signal';

export type CalendarEventTypeKey = CalendarEvent['type'];

/** 캘린더 필터 UI·저장 순서 */
export const CALENDAR_EVENT_TYPE_ORDER: CalendarEventTypeKey[] = [
  'earnings',
  'macro',
  'fed',
  'fomc',
];
