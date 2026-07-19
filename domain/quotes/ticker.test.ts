/**
 * 티커/종목코드 검증 — 관심종목·심볼 라우트 입력.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isValidKrxStockCode,
  isValidQuoteSymbol,
  isValidUsTicker,
  normalizeUsTickerSymbol,
} from './ticker.ts';

describe('ticker validation', () => {
  it('normalizes US tickers', () => {
    assert.equal(normalizeUsTickerSymbol('  brk.b '), 'BRK.B');
  });

  it('accepts common US and KRX forms', () => {
    assert.equal(isValidUsTicker('SPY'), true);
    assert.equal(isValidUsTicker('BRK.B'), true);
    assert.equal(isValidKrxStockCode('005930'), true);
    assert.equal(isValidQuoteSymbol('005930'), true);
  });

  it('rejects empty / overlong / junk', () => {
    assert.equal(isValidUsTicker(''), false);
    assert.equal(isValidUsTicker('THISISWAYTOOLONG'), false);
    assert.equal(isValidUsTicker('BAD!'), false);
    assert.equal(isValidKrxStockCode('5930'), false);
  });
});
