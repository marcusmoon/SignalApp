import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOME_FX_DEFS,
  HOME_FX_SYMBOLS,
  formatHomeFxRate,
  homeFxDefForSymbol,
  homeFxDefsForLayout,
  homeFxDisplayRate,
  isHomeFxSymbol,
} from './homeFx.ts';

describe('homeFx', () => {
  it('lists USD, JPY, CNY Yahoo pairs', () => {
    assert.deepEqual([...HOME_FX_SYMBOLS], ['USDKRW=X', 'JPYKRW=X', 'CNYKRW=X']);
    assert.equal(HOME_FX_DEFS.length, 3);
    assert.equal(isHomeFxSymbol('cnykrw=x'), true);
    assert.equal(homeFxDefForSymbol('CNYKRW=X')?.wideOnly, true);
    assert.equal(homeFxDefForSymbol('JPYKRW=X')?.displayScale, 100);
  });

  it('shows CNY only on wide layout', () => {
    assert.deepEqual(
      homeFxDefsForLayout(false).map((row) => row.key),
      ['usdKrw', 'jpyKrw'],
    );
    assert.deepEqual(
      homeFxDefsForLayout(true).map((row) => row.key),
      ['usdKrw', 'jpyKrw', 'cnyKrw'],
    );
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
