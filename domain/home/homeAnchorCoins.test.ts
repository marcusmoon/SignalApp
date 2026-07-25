/**
 * 홈 BTC·ETH 앵커 — 워치리스트 중복 제외.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterHomeAnchorCoinsNotInWatchlist,
  pickHomeAnchorCoinsFromList,
} from './homeAnchorCoins.ts';

describe('pickHomeAnchorCoinsFromList', () => {
  it('keeps BTC then ETH order and skips missing', () => {
    const rows = pickHomeAnchorCoinsFromList([
      { symbol: 'eth' },
      { symbol: 'SOL' },
      { symbol: 'btc' },
    ]);
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['btc', 'eth'],
    );
  });
});

describe('filterHomeAnchorCoinsNotInWatchlist', () => {
  it('drops anchors already on the watchlist', () => {
    const rows = filterHomeAnchorCoinsNotInWatchlist(
      [{ symbol: 'BTC' }, { symbol: 'ETH' }],
      ['eth', 'AAPL'],
    );
    assert.deepEqual(
      rows.map((row) => row.symbol),
      ['BTC'],
    );
  });
});
