import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOME_FX_DEFS,
  HOME_FX_SYMBOLS,
  formatHomeFxRate,
  homeFxDefForSymbol,
  isHomeFxSymbol,
} from './homeFx.ts';

describe('homeFx', () => {
  it('lists USD and JPY vs KRW Yahoo pairs', () => {
    assert.deepEqual([...HOME_FX_SYMBOLS], ['USDKRW=X', 'JPYKRW=X']);
    assert.equal(HOME_FX_DEFS.length, 2);
    assert.equal(isHomeFxSymbol('usdkrw=x'), true);
    assert.equal(homeFxDefForSymbol('JPYKRW=X')?.key, 'jpyKrw');
    assert.equal(isHomeFxSymbol('^GSPC'), false);
  });

  it('formats rates with two decimals', () => {
    assert.equal(formatHomeFxRate(1380.2), '1,380.20');
    assert.equal(formatHomeFxRate(9.456), '9.46');
    assert.equal(formatHomeFxRate(null), '—');
  });
});
