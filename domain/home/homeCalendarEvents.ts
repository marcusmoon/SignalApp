/**
 * Home calendar chips: key macros + FOMC/Fed/holiday + watchlist earnings.
 * Full calendar still shows all event types.
 */

import type { CalendarEvent } from '../../types/signal.ts';
import { calendarEventDisplayYmd, calendarEventInLocalYmdRange } from '../../utils/date.ts';

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
export function isHomePolicyFedEvent(title: string): boolean {
  const upper = String(title || '').toUpperCase();
  if (!upper) return false;
  if (/\bFOMC\b/.test(upper)) return true;
  if (/\bFEDERAL\s+RESERVE\b|\bFED\s+CHAIR\b|\bPOWELL\b/.test(upper)) return true;
  return false;
}

export function isHomeHighlightMacro(title: string): boolean {
  const text = String(title || '').trim();
  if (!text) return false;
  if (isHomePolicyFedEvent(text)) return true;
  return HIGHLIGHT_MACRO_PATTERNS.some((pattern) => pattern.test(text));
}

/** Short chip name: `CPI`, `NFP`, `FOMC` — not generic “지표”. */
export function homeCalendarChipShortName(event: CalendarEvent, typeLabel = ''): string {
  const title = String(event.title || '').trim();
  const upper = title.toUpperCase();
  if (event.type === 'fomc' || /\bFOMC\b/.test(upper)) return typeLabel.trim() || 'FOMC';
  if (event.type === 'fed' && isHomePolicyFedEvent(title)) return typeLabel.trim() || 'Fed';
  if (event.type === 'earnings') {
    return String(event.symbol || '').trim() || typeLabel.trim() || title.slice(0, 12) || '—';
  }
  if (event.type === 'holiday') {
    return typeLabel.trim() || title.slice(0, 12) || '—';
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
  return cleaned.slice(0, 14) || typeLabel.trim() || '—';
}

function homeCalendarPriority(event: CalendarEvent): number {
  if (event.type === 'fomc' || (event.type === 'fed' && isHomePolicyFedEvent(event.title))) return 0;
  if (event.type === 'macro' && isHomeHighlightMacro(event.title)) return 1;
  if (event.type === 'holiday') return 2;
  if (event.type === 'earnings') return 3;
  if (event.type === 'fed') return 4;
  return 9;
}

function sortHomeCalendarEvents(rows: CalendarEvent[]): CalendarEvent[] {
  return [...rows].sort((a, b) => {
    // Chip countdown order is chronological; priority only breaks ties on the same slot.
    return (
      calendarEventDisplayYmd(a).localeCompare(calendarEventDisplayYmd(b)) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      homeCalendarPriority(a) - homeCalendarPriority(b) ||
      a.title.localeCompare(b.title)
    );
  });
}

/**
 * Home chip pool: policy Fed/FOMC, highlight macros, holidays, watchlist earnings.
 * Ordinary Yahoo “noise” macros are dropped so chips stay D-2 CPI / D-1 FOMC style.
 */
export function filterHomeCalendarEvents(
  rows: CalendarEvent[],
  watchlist: string[],
  fromYmd: string,
  toYmd: string,
): CalendarEvent[] {
  const watch = new Set(watchlist.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  return sortHomeCalendarEvents(
    rows.filter((row) => {
      if (!calendarEventInLocalYmdRange(row, fromYmd, toYmd)) return false;
      if (row.type === 'fomc') return true;
      if (row.type === 'fed') return isHomePolicyFedEvent(row.title);
      if (row.type === 'holiday') return true;
      if (row.type === 'macro') return isHomeHighlightMacro(row.title);
      if (row.type !== 'earnings') return false;
      const symbol = String(row.symbol || '').trim().toUpperCase();
      return Boolean(symbol) && watch.has(symbol);
    }),
  );
}
