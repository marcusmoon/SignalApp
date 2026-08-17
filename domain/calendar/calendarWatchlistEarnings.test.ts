import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterCalendarEarningsToWatchlist } from './calendarWatchlistEarnings.ts';

describe('filterCalendarEarningsToWatchlist', () => {
  it('keeps macro rows and drops earnings outside watchlist', () => {
    const rows = filterCalendarEarningsToWatchlist(
      [
        { type: 'macro', symbol: null, title: 'CPI' },
        { type: 'earnings', symbol: 'AAPL', title: 'Apple' },
        { type: 'earnings', symbol: 'ZZZZ', title: 'Other' },
      ],
      ['aapl'],
    );
    assert.deepEqual(
      rows.map((row) => `${row.type}:${row.symbol}`),
      ['macro:null', 'earnings:AAPL'],
    );
  });

  it('drops all earnings when watchlist is empty', () => {
    const rows = filterCalendarEarningsToWatchlist(
      [{ type: 'earnings', symbol: 'AAPL', title: 'Apple' }],
      [],
    );
    assert.equal(rows.length, 0);
  });
});
