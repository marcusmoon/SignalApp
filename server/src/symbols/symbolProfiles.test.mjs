import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSymbolProfile,
  normalizeSymbolMarket,
  publicSymbolMeta,
} from './symbolProfiles.mjs';

describe('normalizeSymbolMarket', () => {
  it('maps briefing us / quotes korea aliases to kr|global', () => {
    assert.equal(normalizeSymbolMarket('us', 'AAPL'), 'global');
    assert.equal(normalizeSymbolMarket('USA', 'AAPL'), 'global');
    assert.equal(normalizeSymbolMarket('korea', '005930'), 'kr');
    assert.equal(normalizeSymbolMarket('kr', '005930'), 'kr');
  });
});

describe('buildSymbolProfile', () => {
  it('registers ticker-only equity with Parqet logo and null name', () => {
    const profile = buildSymbolProfile({ symbol: 'NVDA', source: 'ensure' });
    assert.equal(profile.symbolKey, 'global:NVDA');
    assert.equal(profile.market, 'global');
    assert.equal(profile.name, null);
    assert.match(profile.logoUrl, /parqet\.com\/logos\/symbol\/NVDA/);
    assert.equal(profile.payload.source, 'ensure');
  });

  it('normalizes us market to global for briefing companies', () => {
    const profile = buildSymbolProfile({
      market: 'us',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      source: 'market_briefings_ensure',
    });
    assert.equal(profile.symbolKey, 'global:AAPL');
    assert.equal(profile.name, 'Apple Inc.');
  });

  it('keeps Korean codes under kr with .KS Parqet logo', () => {
    const profile = buildSymbolProfile({ symbol: '005930.KS', name: '삼성전자' });
    assert.equal(profile.symbolKey, 'kr:005930');
    assert.equal(profile.displaySymbol, '005930');
    assert.match(profile.logoUrl, /005930\.KS/);
  });
});

describe('publicSymbolMeta', () => {
  it('exposes display fields for API symbolMeta', () => {
    const meta = publicSymbolMeta({
      market: 'global',
      symbol: 'AMD',
      displaySymbol: 'AMD',
      name: null,
      logoUrl: 'https://assets.parqet.com/logos/symbol/AMD',
    });
    assert.equal(meta.market, 'global');
    assert.equal(meta.displaySymbol, 'AMD');
    assert.equal(meta.name, null);
    assert.ok(meta.logoUrl);
  });
});
