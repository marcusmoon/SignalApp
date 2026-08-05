import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { homeIndexLogoProxy, HOME_INDEX_LOGO_PROXIES } from './homeIndexLogos.mjs';

describe('homeIndexLogoProxy', () => {
  it('maps caret indices to ETF logo proxies', () => {
    assert.equal(homeIndexLogoProxy('^GSPC')?.symbol, 'SPY');
    assert.equal(homeIndexLogoProxy('^KS11')?.market, 'kr');
    assert.equal(homeIndexLogoProxy('^KS11')?.symbol, '069500');
    assert.equal(Object.keys(HOME_INDEX_LOGO_PROXIES).length, 6);
  });
});
