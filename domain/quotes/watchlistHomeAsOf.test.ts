/**
 * 홈 시세 as-of — 주말·종가·코인 분기.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isLocalWeekend,
  isWatchlistQuoteClosed,
  previousWeekdayYmd,
  resolveWatchlistHomeAsOf,
  WATCHLIST_ASOF_FRESH_MS,
} from './watchlistHomeAsOf.ts';

function atLocal(ymd: string, hour: number, minute = 0): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

describe('previousWeekdayYmd', () => {
  it('pulls Sat/Sun back to Friday', () => {
    // 2026-07-25 = Saturday
    assert.equal(previousWeekdayYmd(atLocal('2026-07-25', 12)), '2026-07-24');
    // 2026-07-26 = Sunday
    assert.equal(previousWeekdayYmd(atLocal('2026-07-26', 12)), '2026-07-24');
    // Friday stays
    assert.equal(previousWeekdayYmd(atLocal('2026-07-24', 16)), '2026-07-24');
  });
});

describe('resolveWatchlistHomeAsOf', () => {
  it('coins only → relative even on weekend', () => {
    const now = atLocal('2026-07-25', 14); // Sat
    assert.equal(isLocalWeekend(now), true);
    const resolved = resolveWatchlistHomeAsOf(
      [
        {
          quote: {
            segment: 'coin',
            quoteTime: null,
            fetchedAt: atLocal('2026-07-25', 13, 50).toISOString(),
          },
        },
      ],
      now,
    );
    assert.equal(resolved?.mode, 'relative');
  });

  it('equity on weekend → prior_close (금 종가용 ymd), ignores newer coin', () => {
    const now = atLocal('2026-07-25', 14); // Sat
    const fridayClose = atLocal('2026-07-24', 15, 30).toISOString();
    const resolved = resolveWatchlistHomeAsOf(
      [
        {
          quote: {
            segment: 'kr',
            quoteTime: fridayClose,
            fetchedAt: atLocal('2026-07-25', 10).toISOString(),
          },
        },
        {
          quote: {
            segment: 'coin',
            quoteTime: null,
            fetchedAt: atLocal('2026-07-25', 13, 55).toISOString(),
          },
        },
      ],
      now,
    );
    assert.deepEqual(resolved, { mode: 'prior_close', ymd: '2026-07-24' });
  });

  it('same-day fresh equity → relative', () => {
    const now = atLocal('2026-07-24', 11, 0); // Fri morning
    const iso = atLocal('2026-07-24', 10, 30).toISOString();
    const resolved = resolveWatchlistHomeAsOf(
      [{ quote: { segment: 'us', quoteTime: iso, fetchedAt: iso } }],
      now,
    );
    assert.deepEqual(resolved, { mode: 'relative', iso });
  });

  it('same-day stale equity → today_close', () => {
    const now = atLocal('2026-07-24', 22, 30); // Fri night
    const iso = atLocal('2026-07-24', 15, 30).toISOString();
    assert.ok(now.getTime() - new Date(iso).getTime() > WATCHLIST_ASOF_FRESH_MS);
    const resolved = resolveWatchlistHomeAsOf(
      [{ quote: { segment: 'kr', quoteTime: iso, fetchedAt: iso } }],
      now,
    );
    assert.deepEqual(resolved, { mode: 'today_close' });
  });

  it('weekday before open with prior session → prior_close', () => {
    const now = atLocal('2026-07-27', 8, 0); // Mon morning
    const fridayClose = atLocal('2026-07-24', 15, 30).toISOString();
    const resolved = resolveWatchlistHomeAsOf(
      [{ quote: { segment: 'kr', quoteTime: fridayClose, fetchedAt: fridayClose } }],
      now,
    );
    assert.deepEqual(resolved, { mode: 'prior_close', ymd: '2026-07-24' });
  });

  it('empty / no quote → null', () => {
    assert.equal(resolveWatchlistHomeAsOf([], atLocal('2026-07-24', 12)), null);
    assert.equal(
      resolveWatchlistHomeAsOf([{ quote: null }], atLocal('2026-07-24', 12)),
      null,
    );
  });

  it('FX same-day but hours stale → today_close (not “N시간 전”)', () => {
    const now = atLocal('2026-07-24', 18, 0); // Fri evening
    const print = atLocal('2026-07-24', 9, 0).toISOString(); // ~9h earlier
    const resolved = resolveWatchlistHomeAsOf(
      [{ quote: { segment: 'fx', quoteTime: print, fetchedAt: now.toISOString() } }],
      now,
    );
    assert.deepEqual(resolved, { mode: 'today_close' });
  });

  it('FX weekend → prior_close', () => {
    const now = atLocal('2026-07-25', 14); // Sat
    const fridayPrint = atLocal('2026-07-24', 12, 0).toISOString();
    const resolved = resolveWatchlistHomeAsOf(
      [{ quote: { segment: 'fx', quoteTime: fridayPrint, fetchedAt: now.toISOString() } }],
      now,
    );
    assert.deepEqual(resolved, { mode: 'prior_close', ymd: '2026-07-24' });
  });
});

describe('isWatchlistQuoteClosed', () => {
  it('true when equity/FX print is stale; false for coins and fresh prints', () => {
    const now = atLocal('2026-07-24', 18, 0);
    const stale = atLocal('2026-07-24', 9, 0).toISOString();
    const fresh = atLocal('2026-07-24', 17, 30).toISOString();
    assert.equal(
      isWatchlistQuoteClosed({ segment: 'indices', quoteTime: stale, fetchedAt: now.toISOString() }, now),
      true,
    );
    assert.equal(
      isWatchlistQuoteClosed({ segment: 'us', quoteTime: fresh, fetchedAt: fresh }, now),
      false,
    );
    assert.equal(
      isWatchlistQuoteClosed({ segment: 'coin', quoteTime: null, fetchedAt: stale }, now),
      false,
    );
  });
});
