import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  etfQuoteGroupForSymbol,
  insertEtfQuoteGroupHeaders,
} from './etfGroups.ts';

describe('etfQuoteGroupForSymbol', () => {
  it('classifies broad / sector / macro', () => {
    assert.equal(etfQuoteGroupForSymbol('SPY'), 'broad');
    assert.equal(etfQuoteGroupForSymbol('xlk'), 'sector');
    assert.equal(etfQuoteGroupForSymbol('SMH'), 'sector');
    assert.equal(etfQuoteGroupForSymbol('GLD'), 'macro');
    assert.equal(etfQuoteGroupForSymbol('EEM'), 'macro');
  });
});

describe('insertEtfQuoteGroupHeaders', () => {
  it('inserts a header when the group run changes and keeps order', () => {
    const rows = ['SPY', 'QQQ', 'XLK', 'SMH', 'GLD', 'TLT'].map((symbol) => ({ symbol }));
    assert.deepEqual(insertEtfQuoteGroupHeaders(rows), [
      { type: 'header', group: 'broad' },
      { type: 'row', row: { symbol: 'SPY' } },
      { type: 'row', row: { symbol: 'QQQ' } },
      { type: 'header', group: 'sector' },
      { type: 'row', row: { symbol: 'XLK' } },
      { type: 'row', row: { symbol: 'SMH' } },
      { type: 'header', group: 'macro' },
      { type: 'row', row: { symbol: 'GLD' } },
      { type: 'row', row: { symbol: 'TLT' } },
    ]);
  });

  it('does not invent a second header inside the same run', () => {
    const rows = ['SPY', 'DIA'].map((symbol) => ({ symbol }));
    assert.deepEqual(insertEtfQuoteGroupHeaders(rows), [
      { type: 'header', group: 'broad' },
      { type: 'row', row: { symbol: 'SPY' } },
      { type: 'row', row: { symbol: 'DIA' } },
    ]);
  });
});
