import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLikelyPreferredShare,
  isLikelySpac,
  shouldExcludeFromKrUniverse,
} from './universeExclude.mjs';

describe('universeExclude', () => {
  it('flags preferred by name', () => {
    assert.equal(isLikelyPreferredShare('005935', '삼성전자우'), true);
    assert.equal(isLikelyPreferredShare('005930', '삼성전자'), false);
  });

  it('flags SPAC by name', () => {
    assert.equal(isLikelySpac('123456', '미래에셋비전스팩1호'), true);
  });

  it('excludes halted quotes', () => {
    const r = shouldExcludeFromKrUniverse({
      symbol: '000001',
      name: '테스트',
      quote: { halted: true },
    });
    assert.equal(r.exclude, true);
    assert.equal(r.reason, 'restricted');
  });
});
