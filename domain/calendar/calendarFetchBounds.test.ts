import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CALENDAR_EVENT_DATE_PADDING_DAYS,
  calendarDayFetchBounds,
  calendarMonthFetchBounds,
  calendarRangeContains,
  calendarUnionFetchBounds,
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

describe('calendarUnionFetchBounds', () => {
  it('spans the wider of two ranges', () => {
    const union = calendarUnionFetchBounds(
      { from: '2026-07-29', to: '2026-09-03' },
      { from: '2026-08-12', to: '2026-08-18' },
    );
    assert.equal(union.from, '2026-07-29');
    assert.equal(union.to, '2026-09-03');
  });
});

describe('calendarRangeContains', () => {
  it('is true when the day window fits inside the month window', () => {
    assert.equal(
      calendarRangeContains(
        { from: '2026-07-29', to: '2026-09-03' },
        { from: '2026-08-12', to: '2026-08-18' },
      ),
      true,
    );
  });

  it('is false when the selected day sits outside the visible month window', () => {
    assert.equal(
      calendarRangeContains(
        { from: '2026-02-26', to: '2026-04-03' },
        { from: '2026-02-12', to: '2026-02-18' },
      ),
      false,
    );
  });
});
