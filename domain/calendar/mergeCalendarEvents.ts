import type { SignalApiCalendarEvent } from '../../integrations/signal-api/types.ts';
import type { CalendarEvent } from '../../types/signal.ts';

function mergeRowsById<T extends { id?: string | null }>(batches: readonly T[][]): T[] {
  const byId = new Map<string, T>();
  for (const rows of batches) {
    for (const row of rows) {
      const id = String(row?.id || '').trim();
      if (id) byId.set(id, row);
    }
  }
  return [...byId.values()];
}

export function mergeCalendarEvents(batches: readonly CalendarEvent[][]): CalendarEvent[] {
  return mergeRowsById(batches);
}

export function mergeSignalCalendarEvents(
  batches: readonly SignalApiCalendarEvent[][],
): SignalApiCalendarEvent[] {
  return mergeRowsById(batches).sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.eventAt || '').localeCompare(String(b.eventAt || '')) ||
      String(a.title || '').localeCompare(String(b.title || '')),
  );
}
