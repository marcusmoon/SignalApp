import { shiftLocalYmd, toYmd } from '../../utils/date.ts';

/** Pad event_date queries so earnings shown on adjacent local days are still returned. */
export const CALENDAR_EVENT_DATE_PADDING_DAYS = 3;

export function calendarMonthFetchBounds(year: number, month: number): { from: string; to: string } {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return {
    from: shiftLocalYmd(toYmd(first), -CALENDAR_EVENT_DATE_PADDING_DAYS),
    to: shiftLocalYmd(toYmd(last), CALENDAR_EVENT_DATE_PADDING_DAYS),
  };
}

/** Supplementary range around the selected local day (server filters on event_date). */
export function calendarDayFetchBounds(selectedYmd: string): { from: string; to: string } {
  const ymd = String(selectedYmd || '').slice(0, 10);
  return {
    from: shiftLocalYmd(ymd, -CALENDAR_EVENT_DATE_PADDING_DAYS),
    to: shiftLocalYmd(ymd, CALENDAR_EVENT_DATE_PADDING_DAYS),
  };
}
