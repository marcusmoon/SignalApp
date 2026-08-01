import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOME_FX_DEFS,
  HOME_FX_SYMBOLS,
  formatHomeFxRate,
  homeFxDefForSymbol,
  homeFxDisplayRate,
  isHomeFxSymbol,
} from './homeFx.ts';

describe('homeFx', () => {
  it('lists USD and JPY vs KRW Yahoo pairs', () => {
    assert.deepEqual([...HOME_FX_SYMBOLS], ['USDKRW=X', 'JPYKRW=X']);
    assert.equal(HOME_FX_DEFS.length, 2);
    assert.equal(isHomeFxSymbol('usdkrw=x'), true);
    assert.equal(homeFxDefForSymbol('JPYKRW=X')?.key, 'jpyKrw');
    assert.equal(homeFxDefForSymbol('JPYKRW=X')?.displayScale, 100);
    assert.equal(isHomeFxSymbol('^GSPC'), false);
  });

  it('formats USD as unit rate and JPY per 100 yen', () => {
    const usd = homeFxDefForSymbol('USDKRW=X');
    const jpy = homeFxDefForSymbol('JPYKRW=X');
    assert.equal(formatHomeFxRate(1380.2, usd), '1,380.20');
    assert.equal(formatHomeFxRate(9.138, jpy), '913.80');
    assert.equal(homeFxDisplayRate(9.138, jpy), 913.8);
    assert.equal(formatHomeFxRate(null), '—');
  });
});
