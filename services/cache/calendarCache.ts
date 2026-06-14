/** Calendar merged cache — cleared from settings alongside other client caches. */
export const CALENDAR_CACHE_TTL_MS = 15 * 60 * 1000;

export function clearCalendarCache(): void {
  /* calendar events are cached in integrations/signal-api/cache/calendarCache */
}
