/**
 * 홈 코인 앵커 — compact 2 / wide 3 · 리스트 순 · 워치리스트 제외.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterHomeAnchorCoinsNotInWatchlist,
  homeAnchorCoinCount,
  pickHomeAnchorCoinsFromList,
} from './homeAnchorCoins.ts';

describe('homeAnchorCoinCount', () => {
  it('compact 2 · wide 3', () => {
    assert.equal(homeAnchorCoinCount(false), 2);
    assert.equal(homeAnchorCoinCount(true), 3);
  });
});

describe('pickHomeAnchorCoinsFromList', () => {
  it('keeps API/list order (not marketCap re-rank)', () => {
    const rows = pickHomeAnchorCoinsFromList(
      [
        { symbol: 'BTC', marketCap: null },
        { symbol: 'ETH', marketCap: null },
        { symbol: 'BNB', marketCap: 100 },
        { symbol: 'ADA', marketCap: 9999 },
      ],
      3,
    );
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['BTC', 'ETH', 'BNB'],
    );
  });

  it('skips watchlist symbols and fills next ranks', () => {
    const rows = pickHomeAnchorCoinsFromList(
      [
        { symbol: 'BTC', marketCap: 1000 },
        { symbol: 'ETH', marketCap: 400 },
        { symbol: 'BNB', marketCap: 100 },
        { symbol: 'SOL', marketCap: 90 },
      ],
      2,
      ['btc', 'eth'],
    );
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['BNB', 'SOL'],
    );
  });
});

describe('filterHomeAnchorCoinsNotInWatchlist', () => {
  it('drops anchors already on the watchlist', () => {
    const rows = filterHomeAnchorCoinsNotInWatchlist(
      [{ symbol: 'BTC' }, { symbol: 'ETH' }, { symbol: 'SOL' }],
      ['eth', 'AAPL'],
    );
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['BTC', 'SOL'],
    );
  });
});
