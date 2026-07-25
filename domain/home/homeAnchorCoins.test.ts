/**
 * 홈 시총 상위 코인 앵커 — compact 2 / wide 3 · 워치리스트 제외.
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
  it('picks by marketCap desc, not list order', () => {
    const rows = pickHomeAnchorCoinsFromList(
      [
        { symbol: 'SOL', marketCap: 80 },
        { symbol: 'BTC', marketCap: 1000 },
        { symbol: 'ETH', marketCap: 400 },
        { symbol: 'XRP', marketCap: 90 },
      ],
      3,
    );
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['BTC', 'ETH', 'XRP'],
    );
  });

  it('skips watchlist symbols and fills next ranks', () => {
    const rows = pickHomeAnchorCoinsFromList(
      [
        { symbol: 'BTC', marketCap: 1000 },
        { symbol: 'ETH', marketCap: 400 },
        { symbol: 'USDT', marketCap: 120 },
        { symbol: 'BNB', marketCap: 100 },
      ],
      2,
      ['btc', 'eth'],
    );
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['USDT', 'BNB'],
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
