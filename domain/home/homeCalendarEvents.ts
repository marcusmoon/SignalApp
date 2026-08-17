/**
 * Home calendar chips: key macros + FOMC/Fed/holiday + watchlist earnings.
 */

import type { CalendarEvent } from '../../types/signal.ts';
import { calendarEventInLocalYmdRange } from '../../utils/date.ts';
import {
  calendarEventShortTitle,
  filterMeaningfulCalendarEvents,
  isCalendarHighlightMacro,
  isCalendarPolicyFedEvent,
} from '../calendar/calendarEventRelevance.ts';

export {
  calendarEventShortTitle as homeCalendarChipShortName,
  isCalendarHighlightMacro as isHomeHighlightMacro,
  isCalendarPolicyFedEvent as isHomePolicyFedEvent,
} from '../calendar/calendarEventRelevance.ts';

/**
 * Home chip pool: policy Fed/FOMC, highlight macros, holidays, watchlist earnings.
 */
export function filterHomeCalendarEvents(
  rows: CalendarEvent[],
  watchlist: string[],
  fromYmd: string,
  toYmd: string,
): CalendarEvent[] {
  return filterMeaningfulCalendarEvents(
    rows.filter((row) => calendarEventInLocalYmdRange(row, fromYmd, toYmd)),
    watchlist,
  );
}
