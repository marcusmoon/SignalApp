import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCalendarDayListRows,
  calendarEventShortTitle,
  filterMeaningfulCalendarEvents,
  isCalendarHighlightMacro,
  isCalendarPolicyFedEvent,
} from './calendarEventRelevance.ts';
import type { CalendarEvent } from '../../types/signal.ts';

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'type' | 'date'>): CalendarEvent {
  return {
    time: '08:30',
    ...partial,
  };
}

describe('isCalendarHighlightMacro', () => {
  it('keeps CPI / NFP style titles', () => {
    assert.equal(isCalendarHighlightMacro('CPI YY, NSA'), true);
    assert.equal(isCalendarHighlightMacro('Nonfarm Payrolls'), true);
    assert.equal(isCalendarHighlightMacro('Employment Trends*'), false);
  });
});

describe('filterMeaningfulCalendarEvents', () => {
  it('keeps policy, highlight macros, watchlist earnings, holidays', () => {
    const rows = filterMeaningfulCalendarEvents(
      [
        event({ id: '1', title: 'Employment Trends*', type: 'macro', date: '2026-08-10' }),
        event({ id: '2', title: 'CPI YY, NSA', type: 'macro', date: '2026-08-12' }),
        event({ id: '3', title: 'Philly Fed Business Indx*', type: 'fed', date: '2026-08-13' }),
        event({ id: '4', title: 'FOMC Rate Decision', type: 'fomc', date: '2026-08-17' }),
        event({ id: '5', title: 'AAPL earnings', type: 'earnings', date: '2026-08-11', symbol: 'AAPL' }),
        event({ id: '6', title: 'NYSE closed', type: 'holiday', date: '2026-08-11' }),
      ],
      ['AAPL'],
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ['6', '5', '2', '4'],
    );
  });
});

describe('buildCalendarDayListRows', () => {
  it('groups rows by section with headers', () => {
    const rows = buildCalendarDayListRows([
      event({ id: 'e1', title: 'AAPL', type: 'earnings', date: '2026-08-11', symbol: 'AAPL' }),
      event({ id: 'm1', title: 'CPI YY, NSA', type: 'macro', date: '2026-08-11' }),
      event({ id: 'p1', title: 'FOMC Rate Decision', type: 'fomc', date: '2026-08-11' }),
    ]);
    assert.deepEqual(
      rows.map((row) => (row.kind === 'header' ? `h:${row.section}` : row.event.id)),
      ['h:policy', 'p1', 'h:macro', 'm1', 'h:earnings', 'e1'],
    );
  });
});

describe('calendarEventShortTitle', () => {
  it('uses CPI / FOMC short labels', () => {
    assert.equal(
      calendarEventShortTitle(event({ id: '1', title: 'CPI YY, NSA', type: 'macro', date: '2026-08-12' }), '지표'),
      'CPI',
    );
    assert.equal(isCalendarPolicyFedEvent('Fed Chair Powell Speaks'), true);
  });
});
