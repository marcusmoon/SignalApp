import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFujimotoToSnapshot,
  passesFujimoto,
  sortFujimotoItems,
} from './fujimoto.mjs';

const base = {
  symbol: '005930',
  revenueYoY: 0.1,
  operatingProfitYoY: 0.1,
  netProfitYoY: 0.1,
  per: 12,
  pbr: 0.9,
  dividend: true,
  turnoverKrw: 20_000_000_000,
  rsi: 25,
  changePercent: -2,
};

describe('passesFujimoto', () => {
  it('accepts a full-metric pass', () => {
    assert.equal(passesFujimoto(base), true);
  });

  it('rejects missing metrics', () => {
    assert.equal(passesFujimoto({ ...base, per: null }), false);
    assert.equal(passesFujimoto({ ...base, rsi: null }), false);
  });

  it('rejects RSI above 30', () => {
    assert.equal(passesFujimoto({ ...base, rsi: 31 }), false);
  });
});

describe('sortFujimotoItems', () => {
  it('orders by RSI then changePercent', () => {
    const sorted = sortFujimotoItems([
      { ...base, symbol: 'A', rsi: 29, changePercent: -1 },
      { ...base, symbol: 'B', rsi: 20, changePercent: -1 },
      { ...base, symbol: 'C', rsi: 20, changePercent: -3 },
    ]);
    assert.deepEqual(
      sorted.map((r) => r.symbol),
      ['C', 'B', 'A'],
    );
  });
});

describe('applyFujimotoToSnapshot', () => {
  it('filters and caps items', () => {
    const items = applyFujimotoToSnapshot({
      policy: { minTurnoverKrw: 10_000_000_000 },
      symbols: [
        base,
        { ...base, symbol: '000660', rsi: 40 },
        { ...base, symbol: '035420', rsi: 22, changePercent: -5 },
      ],
    });
    assert.equal(items.length, 2);
    assert.equal(items[0].symbol, '035420');
  });
});
