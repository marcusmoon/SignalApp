/**
 * Pick name/logo from API symbolMeta (+ legacy fallbacks).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  pickSymbolMetaLogoUrl,
  pickSymbolMetaName,
  pickSymbolMetaSymbol,
  resolveRowSymbolIdentity,
} from './symbolMetaDisplay.ts';

describe('pickSymbolMeta*', () => {
  it('prefers symbolMeta over legacy fields', () => {
    const row = {
      symbol: '005930.KS',
      name: 'Legacy',
      imageUrl: 'https://legacy.example/x.png',
      symbolMeta: {
        market: 'kr' as const,
        symbol: '005930',
        displaySymbol: '005930',
        name: '삼성전자',
        logoUrl: 'https://cdn.example/005930.png',
      },
    };
    assert.equal(pickSymbolMetaName(row), '삼성전자');
    assert.equal(pickSymbolMetaLogoUrl(row), 'https://cdn.example/005930.png');
    assert.equal(pickSymbolMetaSymbol(row), '005930');
  });

  it('keeps global tickers company-name free in resolveRowSymbolIdentity', () => {
    const identity = resolveRowSymbolIdentity({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      symbolMeta: {
        market: 'global',
        symbol: 'AAPL',
        displaySymbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: 'https://cdn.example/aapl.png',
      },
    });
    assert.equal(identity?.displaySymbol, 'AAPL');
    assert.equal(identity?.displayName, null);
    assert.equal(identity?.imageUrl, 'https://cdn.example/aapl.png');
  });
});
