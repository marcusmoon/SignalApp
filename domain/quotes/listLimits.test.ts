import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isLegacyQuotesListLimitsTripleRaw,
  normalizeQuotesListLimits,
  QUOTES_LIST_LIMITS_DEFAULTS,
} from './listLimits.ts';

describe('normalizeQuotesListLimits', () => {
  it('defaults etf/coin to 20', () => {
    assert.deepEqual(normalizeQuotesListLimits({}), QUOTES_LIST_LIMITS_DEFAULTS);
  });

  it('migrates popularMax then mcapMax into etfMax', () => {
    assert.equal(normalizeQuotesListLimits({ popularMax: 30 }).etfMax, 30);
    assert.equal(normalizeQuotesListLimits({ mcapMax: 40 }).etfMax, 40);
    assert.equal(normalizeQuotesListLimits({ popularMax: 30, mcapMax: 40 }).etfMax, 30);
    assert.equal(normalizeQuotesListLimits({ etfMax: 50, popularMax: 30 }).etfMax, 50);
  });

  it('snaps to 10-step choices', () => {
    assert.equal(normalizeQuotesListLimits({ etfMax: 23 }).etfMax, 20);
    assert.equal(normalizeQuotesListLimits({ coinMax: 27 }).coinMax, 30);
  });
});

describe('isLegacyQuotesListLimitsTripleRaw', () => {
  it('detects old 14/15/20 triple', () => {
    assert.equal(isLegacyQuotesListLimitsTripleRaw({ popularMax: 14, mcapMax: 15, coinMax: 20 }), true);
    assert.equal(isLegacyQuotesListLimitsTripleRaw({ etfMax: 20, coinMax: 20 }), false);
  });
});
