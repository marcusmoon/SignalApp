/**
 * 히트맵 채색 — 강도 · trend soft pct · 포맷.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatHeatChangePct,
  heatFillColor,
  hexWithAlpha,
  trendToSoftChangePercent,
} from './changeHeat.ts';

describe('formatHeatChangePct', () => {
  it('formats signed percent and null as em dash', () => {
    assert.equal(formatHeatChangePct(1.2), '+1.20%');
    assert.equal(formatHeatChangePct(-0.5), '-0.50%');
    assert.equal(formatHeatChangePct(null), '—');
  });
});

describe('heatFillColor', () => {
  it('returns neutral for null/zero and scales alpha by |pct|/3', () => {
    assert.equal(heatFillColor(null, '#FF0000', '#0000FF', '#111111'), '#111111');
    assert.equal(heatFillColor(0, '#FF0000', '#0000FF', '#111111'), '#111111');
    const mild = heatFillColor(1.5, '#FF0000', '#0000FF', '#111111');
    const sat = heatFillColor(3, '#FF0000', '#0000FF', '#111111');
    assert.ok(mild.startsWith('#FF0000'));
    assert.ok(sat.startsWith('#FF0000'));
    assert.notEqual(mild, sat);
    assert.equal(heatFillColor(-3, '#FF0000', '#0000FF', '#111111'), hexWithAlpha('#0000FF', 0.64));
  });
});

describe('trendToSoftChangePercent', () => {
  it('maps up/down trend tokens used when numeric pct missing', () => {
    assert.equal(trendToSoftChangePercent('상승'), 0.8);
    assert.equal(trendToSoftChangePercent('▼'), -0.8);
    assert.equal(trendToSoftChangePercent('unknown'), null);
  });
});
