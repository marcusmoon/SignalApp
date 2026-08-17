import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';

export function mergeSignalCalendarEvents(
  batches: readonly SignalApiCalendarEvent[][],
): SignalApiCalendarEvent[] {
  const byId = new Map<string, SignalApiCalendarEvent>();
  for (const rows of batches) {
    for (const row of rows) {
      const id = String(row?.id || '').trim();
      if (id) byId.set(id, row);
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.eventAt || '').localeCompare(String(b.eventAt || '')) ||
      String(a.title || '').localeCompare(String(b.title || '')),
  );
}
