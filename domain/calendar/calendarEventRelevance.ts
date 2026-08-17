/**
 * Shared rules for “meaningful” calendar rows — home chips and calendar day list.
 */

import type { CalendarEvent } from '../../types/signal.ts';
import { calendarEventDisplayYmd } from '../../utils/date.ts';

const HIGHLIGHT_MACRO_PATTERNS: RegExp[] = [
  /\bCPI\b/i,
  /\bPPI\b/i,
  /\bPCE\b/i,
  /\bGDP\b/i,
  /NON[\s-]?FARM|PAYROLL/i,
  /UNEMPLOYMENT/i,
  /JOBLESS\s+CLAIMS/i,
  /RETAIL\s+SALES/i,
  /\bISM\b/i,
  /CONSUMER\s+CONFIDENCE/i,
  /EXIST(?:ING|\.)?\s+HOME\s+SALES/i,
];

/** True Fed/FOMC policy events — not regional “Philly Fed” surveys. */
export function isCalendarPolicyFedEvent(title: string): boolean {
  const upper = String(title || '').toUpperCase();
  if (!upper) return false;
  if (/\bFOMC\b/.test(upper)) return true;
  if (/\bFEDERAL\s+RESERVE\b|\bFED\s+CHAIR\b|\bPOWELL\b/.test(upper)) return true;
  return false;
}

export function isCalendarHighlightMacro(title: string): boolean {
  const text = String(title || '').trim();
  if (!text) return false;
  if (isCalendarPolicyFedEvent(text)) return true;
  return HIGHLIGHT_MACRO_PATTERNS.some((pattern) => pattern.test(text));
}

export function calendarEventShortTitle(event: CalendarEvent, typeLabel = ''): string {
  const title = String(event.title || '').trim();
  const upper = title.toUpperCase();
  if (event.type === 'fomc' || /\bFOMC\b/.test(upper)) return typeLabel.trim() || 'FOMC';
  if (event.type === 'fed' && isCalendarPolicyFedEvent(title)) return typeLabel.trim() || 'Fed';
  if (event.type === 'earnings') {
    return String(event.symbol || '').trim() || typeLabel.trim() || title.slice(0, 12) || '—';
  }
  if (event.type === 'holiday') {
    return typeLabel.trim() || title.slice(0, 24) || '—';
  }

  if (/CORE\s+CPI|\bCORE CPI\b/i.test(title)) return 'Core CPI';
  if (/\bCPI\b/i.test(title)) return 'CPI';
  if (/CORE\s+PPI|\bCORE PPI\b/i.test(title)) return 'Core PPI';
  if (/\bPPI\b/i.test(title)) return 'PPI';
  if (/\bPCE\b/i.test(title)) return 'PCE';
  if (/\bGDP\b/i.test(title)) return 'GDP';
  if (/NON[\s-]?FARM|PAYROLL/i.test(title)) return 'NFP';
  if (/UNEMPLOYMENT/i.test(title)) return 'Unemployment';
  if (/JOBLESS\s+CLAIMS/i.test(title)) return 'Jobless';
  if (/RETAIL\s+SALES/i.test(title)) return 'Retail';
  if (/\bISM\b/i.test(title) && /SERVICE|NON-MANUFACTURING/i.test(title)) return 'ISM Services';
  if (/\bISM\b/i.test(title)) return 'ISM';
  if (/CONSUMER\s+CONFIDENCE/i.test(title)) return 'Confidence';
  if (/EXIST(?:ING|\.)?\s+HOME\s+SALES/i.test(title)) return 'Home Sales';

  const cleaned = title.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 28) || typeLabel.trim() || '—';
}

export function calendarEventPriority(event: CalendarEvent): number {
  if (event.type === 'fomc' || (event.type === 'fed' && isCalendarPolicyFedEvent(event.title))) return 0;
  if (event.type === 'macro' && isCalendarHighlightMacro(event.title)) return 1;
  if (event.type === 'holiday') return 2;
  if (event.type === 'earnings') return 3;
  if (event.type === 'fed') return 4;
  if (event.type === 'macro') return 5;
  return 9;
}

export function sortCalendarDayEvents(rows: CalendarEvent[]): CalendarEvent[] {
  return [...rows].sort((a, b) => {
    const aYmd = calendarEventDisplayYmd(a);
    const bYmd = calendarEventDisplayYmd(b);
    return (
      aYmd.localeCompare(bYmd) ||
      String(a.eventAt || a.time || '').localeCompare(String(b.eventAt || b.time || '')) ||
      calendarEventPriority(a) - calendarEventPriority(b) ||
      a.title.localeCompare(b.title)
    );
  });
}

export function isCalendarMeaningfulEvent(
  event: CalendarEvent,
  watchlistSymbols: readonly string[],
): boolean {
  if (event.type === 'fomc') return true;
  if (event.type === 'fed') return isCalendarPolicyFedEvent(event.title);
  if (event.type === 'holiday') return true;
  if (event.type === 'macro') return isCalendarHighlightMacro(event.title);
  if (event.type !== 'earnings') return false;
  const watch = new Set(
    watchlistSymbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean),
  );
  const symbol = String(event.symbol || '').trim().toUpperCase();
  return Boolean(symbol) && watch.has(symbol);
}

export function filterMeaningfulCalendarEvents(
  rows: CalendarEvent[],
  watchlistSymbols: readonly string[],
): CalendarEvent[] {
  return sortCalendarDayEvents(
    rows.filter((row) => isCalendarMeaningfulEvent(row, watchlistSymbols)),
  );
}

export type CalendarDaySectionKey = 'policy' | 'macro' | 'earnings' | 'holiday';

export function calendarEventSectionKey(event: CalendarEvent): CalendarDaySectionKey {
  if (event.type === 'fomc' || (event.type === 'fed' && isCalendarPolicyFedEvent(event.title))) {
    return 'policy';
  }
  if (event.type === 'earnings') return 'earnings';
  if (event.type === 'holiday') return 'holiday';
  return 'macro';
}

const CALENDAR_DAY_SECTION_ORDER: CalendarDaySectionKey[] = ['policy', 'macro', 'earnings', 'holiday'];

export type CalendarDayListRow =
  | { kind: 'header'; id: string; section: CalendarDaySectionKey }
  | { kind: 'event'; id: string; event: CalendarEvent };

export function buildCalendarDayListRows(events: CalendarEvent[]): CalendarDayListRow[] {
  const sorted = sortCalendarDayEvents(events);
  const bySection = new Map<CalendarDaySectionKey, CalendarEvent[]>();
  for (const event of sorted) {
    const key = calendarEventSectionKey(event);
    const bucket = bySection.get(key) || [];
    bucket.push(event);
    bySection.set(key, bucket);
  }

  const rows: CalendarDayListRow[] = [];
  for (const section of CALENDAR_DAY_SECTION_ORDER) {
    const sectionEvents = bySection.get(section);
    if (!sectionEvents?.length) continue;
    rows.push({ kind: 'header', id: `header:${section}`, section });
    for (const event of sectionEvents) {
      rows.push({ kind: 'event', id: event.id, event });
    }
  }
  return rows;
}

/** @deprecated use isCalendarPolicyFedEvent */
export const isHomePolicyFedEvent = isCalendarPolicyFedEvent;
/** @deprecated use isCalendarHighlightMacro */
export const isHomeHighlightMacro = isCalendarHighlightMacro;
/** @deprecated use calendarEventShortTitle */
export const homeCalendarChipShortName = calendarEventShortTitle;
