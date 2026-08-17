import { CALENDAR_EVENT_TYPE_ORDER, type CalendarEventTypeKey } from './constants.ts';

export type CalendarViewFilterKey =
  | 'meaningful'
  | 'macro'
  | 'earnings'
  | 'policy'
  | 'holiday'
  | 'full';

/** 캘린더 상단 세그먼트 순서 — 주요 → 유형 → 전체 */
export const CALENDAR_VIEW_FILTER_ORDER: readonly CalendarViewFilterKey[] = [
  'meaningful',
  'macro',
  'earnings',
  'policy',
  'holiday',
  'full',
];

export function isCalendarViewFilterKey(value: unknown): value is CalendarViewFilterKey {
  return CALENDAR_VIEW_FILTER_ORDER.includes(value as CalendarViewFilterKey);
}

export function calendarViewFilterTypes(
  filter: CalendarViewFilterKey,
): readonly CalendarEventTypeKey[] {
  if (filter === 'macro') return ['macro'];
  if (filter === 'earnings') return ['earnings'];
  if (filter === 'policy') return ['fed', 'fomc'];
  if (filter === 'holiday') return ['holiday'];
  return CALENDAR_EVENT_TYPE_ORDER;
}

export function calendarViewFetchType(filter: CalendarViewFilterKey): string | undefined {
  if (filter === 'macro' || filter === 'earnings' || filter === 'holiday') return filter;
  if (filter === 'policy') return 'policy';
  return undefined;
}

export function calendarViewUsesMeaningfulScope(filter: CalendarViewFilterKey): boolean {
  return filter === 'meaningful';
}

export function calendarViewShowsDaySections(filter: CalendarViewFilterKey): boolean {
  return filter === 'meaningful' || filter === 'full';
}
