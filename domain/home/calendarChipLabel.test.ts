import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  homeCalendarChipLabel,
  homeCalendarAgendaIsEmpty,
  splitHomeCalendarAgenda,
} from './calendarChipLabel.ts';
import type { CalendarEvent } from '../../types/signal.ts';

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'type' | 'date'>): CalendarEvent {
  return {
    time: '08:30',
    ...partial,
  };
}

describe('splitHomeCalendarAgenda', () => {
  it('keeps selected-day rows and upcoming chips when viewing today', () => {
    const agenda = splitHomeCalendarAgenda(
      [
        event({ id: '1', title: 'CPI', type: 'macro', date: '2026-08-17' }),
        event({ id: '2', title: 'FOMC', type: 'fomc', date: '2026-08-19' }),
        event({ id: '3', title: 'NFP', type: 'macro', date: '2026-08-21' }),
      ],
      '2026-08-17',
      '2026-08-17',
    );
    assert.deepEqual(
      agenda.today.map((row) => row.id),
      ['1'],
    );
    assert.deepEqual(
      agenda.upcoming.map((row) => row.id),
      ['2', '3'],
    );
  });

  it('drops lookahead when viewing a past day', () => {
    const agenda = splitHomeCalendarAgenda(
      [
        event({ id: '1', title: 'CPI', type: 'macro', date: '2026-08-10' }),
        event({ id: '2', title: 'FOMC', type: 'fomc', date: '2026-08-19' }),
      ],
      '2026-08-10',
      '2026-08-17',
    );
    assert.deepEqual(
      agenda.today.map((row) => row.id),
      ['1'],
    );
    assert.equal(agenda.upcoming.length, 0);
    assert.equal(homeCalendarAgendaIsEmpty(agenda), false);
  });
});

describe('homeCalendarChipLabel', () => {
  it('uses D-Day on the selected day', () => {
    assert.equal(
      homeCalendarChipLabel(
        event({ id: '1', title: 'CPI', type: 'macro', date: '2026-08-17' }),
        '2026-08-17',
        'CPI',
      ),
      'D-Day CPI',
    );
  });
});
