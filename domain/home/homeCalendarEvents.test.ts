import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterHomeCalendarEvents,
  homeCalendarChipShortName,
  isHomeHighlightMacro,
  isHomePolicyFedEvent,
} from './homeCalendarEvents.ts';
import type { CalendarEvent } from '../../types/signal.ts';

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'type' | 'date'>): CalendarEvent {
  return {
    time: '08:30',
    ...partial,
  };
}

describe('isHomeHighlightMacro', () => {
  it('keeps CPI / NFP style titles', () => {
    assert.equal(isHomeHighlightMacro('CPI YY, NSA'), true);
    assert.equal(isHomeHighlightMacro('Nonfarm Payrolls'), true);
    assert.equal(isHomeHighlightMacro('Employment Trends*'), false);
    assert.equal(isHomeHighlightMacro('Redbook YY *'), false);
  });
});

describe('isHomePolicyFedEvent', () => {
  it('accepts FOMC / Powell, rejects Philly Fed', () => {
    assert.equal(isHomePolicyFedEvent('FOMC Rate Decision'), true);
    assert.equal(isHomePolicyFedEvent('Fed Chair Powell Speaks'), true);
    assert.equal(isHomePolicyFedEvent('Philly Fed Business Indx*'), false);
  });
});

describe('filterHomeCalendarEvents', () => {
  it('includes highlight macros and drops noise', () => {
    const rows = filterHomeCalendarEvents(
      [
        event({ id: '1', title: 'Employment Trends*', type: 'macro', date: '2026-08-10' }),
        event({ id: '2', title: 'CPI YY, NSA', type: 'macro', date: '2026-08-12' }),
        event({ id: '3', title: 'Philly Fed Business Indx*', type: 'fed', date: '2026-08-13' }),
        event({ id: '4', title: 'FOMC Rate Decision', type: 'fomc', date: '2026-08-17' }),
        event({ id: '5', title: 'AAPL earnings', type: 'earnings', date: '2026-08-11', symbol: 'AAPL' }),
      ],
      ['AAPL'],
      '2026-08-09',
      '2026-08-23',
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ['5', '2', '4'],
    );
  });
});

describe('homeCalendarChipShortName', () => {
  it('uses CPI / FOMC short labels', () => {
    assert.equal(
      homeCalendarChipShortName(event({ id: '1', title: 'CPI YY, NSA', type: 'macro', date: '2026-08-12' }), '지표'),
      'CPI',
    );
    assert.equal(
      homeCalendarChipShortName(
        event({ id: '2', title: 'FOMC Rate Decision', type: 'fomc', date: '2026-08-17' }),
        'FOMC',
      ),
      'FOMC',
    );
  });
});
