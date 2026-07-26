import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeRsi } from './rsi.mjs';

describe('computeRsi', () => {
  it('returns null when not enough bars', () => {
    assert.equal(computeRsi([1, 2, 3], 14), null);
  });

  it('returns a value in 0–100 for a long series', () => {
    const closes = [];
    for (let i = 0; i < 40; i++) closes.push(100 + Math.sin(i / 3) * 5 + i * 0.1);
    const rsi = computeRsi(closes, 14);
    assert.ok(rsi != null);
    assert.ok(rsi >= 0 && rsi <= 100);
  });
});
