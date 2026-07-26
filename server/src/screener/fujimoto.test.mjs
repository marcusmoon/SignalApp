import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFujimotoToSnapshot,
  fujimotoReturnBlend,
  passesFujimoto,
  sortFujimotoItems,
} from './fujimoto.mjs';

const base = {
  symbol: '005930',
  currentPrice: 71_200,
  changePercent: 1.2,
  alignedMa: true,
  ma200: 65_000,
  pctFrom52wHigh: -4,
  volumeRatio: 1.4,
  turnoverKrw: 20_000_000_000,
  rsi: 62,
  return3m: 18,
  return6m: 25,
  return12m: 40,
};

describe('passesFujimoto', () => {
  it('accepts a full-metric momentum pass', () => {
    assert.equal(passesFujimoto(base), true);
  });

  it('rejects missing core metrics (nullMeansFail)', () => {
    assert.equal(passesFujimoto({ ...base, ma200: null }), false);
    assert.equal(passesFujimoto({ ...base, pctFrom52wHigh: null }), false);
    assert.equal(passesFujimoto({ ...base, volumeRatio: null }), false);
    assert.equal(passesFujimoto({ ...base, rsi: null }), false);
    assert.equal(passesFujimoto({ ...base, return3m: null }), false);
  });

  it('rejects broken trend structure', () => {
    assert.equal(passesFujimoto({ ...base, alignedMa: false }), false);
    assert.equal(passesFujimoto({ ...base, alignedMa: null }), false);
    assert.equal(passesFujimoto({ ...base, currentPrice: 60_000 }), false); // below ma200
  });

  it('rejects stocks far from the 52-week high (no bottom-fishing)', () => {
    assert.equal(passesFujimoto({ ...base, pctFrom52wHigh: -10.5 }), false);
    assert.equal(passesFujimoto({ ...base, pctFrom52wHigh: -10 }), true);
  });

  it('rejects shrinking volume and thin turnover', () => {
    assert.equal(passesFujimoto({ ...base, volumeRatio: 0.8 }), false);
    assert.equal(passesFujimoto({ ...base, turnoverKrw: 5_000_000_000 }), false);
  });

  it('does not reject on high RSI (momentum keeps its leaders)', () => {
    assert.equal(passesFujimoto({ ...base, rsi: 82 }), true);
  });
});

describe('fujimotoReturnBlend', () => {
  it('blends 3m/6m/12m at 50/30/20', () => {
    assert.equal(fujimotoReturnBlend(base), 0.5 * 18 + 0.3 * 25 + 0.2 * 40);
  });

  it('re-weights when legs are missing', () => {
    assert.equal(
      fujimotoReturnBlend({ return3m: 10, return6m: null, return12m: null }),
      10,
    );
    assert.equal(fujimotoReturnBlend({}), null);
  });
});

describe('sortFujimotoItems', () => {
  it('orders by return blend desc, then distance to 52w high', () => {
    const sorted = sortFujimotoItems([
      { ...base, symbol: 'A', return3m: 10, return6m: 10, return12m: 10 },
      { ...base, symbol: 'B', return3m: 30, return6m: 30, return12m: 30 },
      { ...base, symbol: 'C', return3m: 10, return6m: 10, return12m: 10, pctFrom52wHigh: -1 },
    ]);
    assert.deepEqual(
      sorted.map((r) => r.symbol),
      ['B', 'C', 'A'],
    );
  });
});

describe('applyFujimotoToSnapshot', () => {
  it('filters momentum passes and caps items', () => {
    const items = applyFujimotoToSnapshot({
      policy: { minTurnoverKrw: 10_000_000_000 },
      symbols: [
        base,
        { ...base, symbol: '000660', alignedMa: false },
        { ...base, symbol: '035420', return3m: 55, return6m: 60, return12m: 80 },
      ],
    });
    assert.equal(items.length, 2);
    assert.equal(items[0].symbol, '035420');
    assert.equal(items[0].passed, true);
  });
});
