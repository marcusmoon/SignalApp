/**
 * 등락 색 규칙 — korea(적상·청하) / us(녹상·적하).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getQuoteChangeColors,
  isQuoteChangePositive,
  normalizeQuotesChangeColorConvention,
} from './changeColorConvention.ts';

describe('normalizeQuotesChangeColorConvention', () => {
  it('defaults unknown to korea', () => {
    assert.equal(normalizeQuotesChangeColorConvention('us'), 'us');
    assert.equal(normalizeQuotesChangeColorConvention('korea'), 'korea');
    assert.equal(normalizeQuotesChangeColorConvention(null), 'korea');
  });
});

describe('getQuoteChangeColors', () => {
  it('korea light: up red, down blue; us light: up green, down red', () => {
    const kr = getQuoteChangeColors('korea', 'light');
    const us = getQuoteChangeColors('us', 'light');
    assert.equal(kr.up, '#F04452');
    assert.equal(kr.down, '#3182F6');
    assert.equal(us.up, '#03B26C');
    assert.equal(us.down, '#F04452');
  });
});

describe('isQuoteChangePositive', () => {
  it('prefers change then changePercent; defaults true', () => {
    assert.equal(isQuoteChangePositive({ change: -1, changePercent: 5 }), false);
    assert.equal(isQuoteChangePositive({ changePercent: -0.1 }), false);
    assert.equal(isQuoteChangePositive({}), true);
  });
});
