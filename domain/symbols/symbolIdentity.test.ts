import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  companyNameForSymbolUi,
  resolveSymbolIdentity,
} from './symbolIdentity.ts';

describe('companyNameForSymbolUi', () => {
  it('keeps KR issuer names and drops global company names', () => {
    assert.equal(companyNameForSymbolUi('삼성전자', '005930'), '삼성전자');
    assert.equal(companyNameForSymbolUi('Apple Inc.', 'AAPL'), null);
    assert.equal(companyNameForSymbolUi('Apple Inc.', 'AAPL.US'), null);
  });
});

describe('resolveSymbolIdentity', () => {
  it('uses ticker-only identity for global symbols', () => {
    const identity = resolveSymbolIdentity({ symbol: 'NVDA', name: 'NVIDIA Corp' });
    assert.equal(identity?.displaySymbol, 'NVDA');
    assert.equal(identity?.displayName, null);
    assert.equal(identity?.market, 'global');
  });
});
