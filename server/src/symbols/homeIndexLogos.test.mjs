import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  homeIndexLogoIdentity,
  homeIndexLogoProxy,
  homeIndexSymbolMeta,
  HOME_INDEX_LOGO_PROXIES,
} from './homeIndexLogos.mjs';

describe('homeIndexLogoProxy', () => {
  it('maps caret indices to ETF logo proxies', () => {
    assert.equal(homeIndexLogoProxy('^GSPC')?.symbol, 'SPY');
    assert.equal(homeIndexLogoProxy('^KS11')?.market, 'kr');
    assert.equal(homeIndexLogoProxy('^KS11')?.symbol, '069500');
    assert.equal(Object.keys(HOME_INDEX_LOGO_PROXIES).length, 6);
    assert.equal(homeIndexLogoIdentity('^NDX')?.symbol, 'QQQ');
  });

  it('builds symbolMeta from proxy profile logoUrl', () => {
    const profiles = new Map([
      [
        'global:SPY',
        {
          symbolKey: 'global:SPY',
          market: 'global',
          symbol: 'SPY',
          displaySymbol: 'SPY',
          name: 'SPDR S&P 500 ETF',
          logoUrl: 'https://assets.parqet.com/logos/symbol/SPY',
        },
      ],
    ]);
    const meta = homeIndexSymbolMeta('^GSPC', profiles);
    assert.equal(meta?.logoUrl, 'https://assets.parqet.com/logos/symbol/SPY');
    assert.equal(meta?.displaySymbol, 'SPY');
  });
});
