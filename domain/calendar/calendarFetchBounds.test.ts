import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CALENDAR_EVENT_DATE_PADDING_DAYS,
  calendarDayFetchBounds,
  calendarMonthFetchBounds,
} from './calendarFetchBounds.ts';

describe('calendarMonthFetchBounds', () => {
  it('pads month edges for event_date timezone drift', () => {
    const bounds = calendarMonthFetchBounds(2026, 7);
    assert.equal(bounds.from, '2026-07-29');
    assert.equal(bounds.to, '2026-09-03');
    assert.equal(CALENDAR_EVENT_DATE_PADDING_DAYS, 3);
  });
});

describe('calendarDayFetchBounds', () => {
  it('centers on selected local day', () => {
    const bounds = calendarDayFetchBounds('2026-08-15');
    assert.equal(bounds.from, '2026-08-12');
    assert.equal(bounds.to, '2026-08-18');
  });
});
