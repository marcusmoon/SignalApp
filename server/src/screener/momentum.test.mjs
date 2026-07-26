import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMomentumMetrics } from './momentum.mjs';

function synthBars({ count, start = 100, step = 1, volume = 1_000_000 }) {
  const bars = [];
  const origin = Date.parse('2024-01-02T00:00:00.000Z');
  for (let i = 0; i < count; i++) {
    const close = start + i * step;
    const date = new Date(origin + i * 86_400_000).toISOString().slice(0, 10);
    bars.push({
      date,
      close,
      high: close + 2,
      volume: i === count - 1 ? volume * 3 : volume,
    });
  }
  return bars;
}

describe('computeMomentumMetrics', () => {
  it('returns nulls when bars are short', () => {
    const m = computeMomentumMetrics(synthBars({ count: 10 }));
    assert.equal(m.return3m, null);
    assert.equal(m.ma20, null);
    assert.equal(m.alignedMa, null);
  });

  it('computes returns, MAs, alignment, 52w%, volume ratio', () => {
    const bars = synthBars({ count: 260, start: 100, step: 1 });
    const m = computeMomentumMetrics(bars);
    assert.ok(m.return3m != null && m.return3m > 0);
    assert.ok(m.return6m != null && m.return6m > 0);
    assert.ok(m.return12m != null && m.return12m > 0);
    assert.ok(m.ma20 != null && m.ma60 != null && m.ma120 != null && m.ma200 != null);
    assert.equal(m.alignedMa, true);
    assert.ok(m.pctFrom52wHigh != null && m.pctFrom52wHigh <= 0);
    assert.ok(m.volumeRatio != null && m.volumeRatio > 1);
  });

  it('marks alignedMa false on downtrend', () => {
    const bars = synthBars({ count: 260, start: 400, step: -1 });
    const m = computeMomentumMetrics(bars);
    assert.equal(m.alignedMa, false);
  });
});
