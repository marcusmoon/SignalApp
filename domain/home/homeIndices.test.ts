/**
 * Home index quote defs — order and Yahoo symbols.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOME_INDEX_DEFS,
  HOME_INDEX_SYMBOLS,
  formatHomeIndexLevel,
  homeIndexDefForSymbol,
  isHomeIndexSymbol,
} from './homeIndices.ts';

describe('HOME_INDEX_DEFS', () => {
  it('keeps agreed order: S&P · Nasdaq · Dow · SOX · KOSPI · Nikkei', () => {
    assert.deepEqual(
      HOME_INDEX_DEFS.map((row) => row.key),
      ['sp500', 'nasdaq', 'dow', 'sox', 'kospi', 'nikkei'],
    );
    assert.deepEqual([...HOME_INDEX_SYMBOLS], ['^GSPC', '^NDX', '^DJI', '^SOX', '^KS11', '^N225']);
  });

  it('maps logoSymbol proxies for index avatar glyphs (caret tickers are awkward)', () => {
    assert.deepEqual(
      HOME_INDEX_DEFS.map((row) => row.logoSymbol),
      ['SPY', 'QQQ', 'DIA', 'SOXX', '069500', 'EWJ'],
    );
  });

  it('looks up by symbol', () => {
    assert.equal(homeIndexDefForSymbol('^ndx')?.key, 'nasdaq');
    assert.equal(isHomeIndexSymbol('^KS11'), true);
    assert.equal(isHomeIndexSymbol('AAPL'), false);
  });
});

describe('formatHomeIndexLevel', () => {
  it('formats without currency prefix', () => {
    assert.equal(formatHomeIndexLevel(5234.56), '5,234.56');
    assert.equal(formatHomeIndexLevel(null), '—');
  });
});
