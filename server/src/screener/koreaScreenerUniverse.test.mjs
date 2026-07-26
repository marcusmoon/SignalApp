import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  KOREA_SCREENER_UNIVERSE_ENTRIES,
  koreaScreenerVenueMap,
  yahooSymbolForVenue,
} from './koreaScreenerUniverse.mjs';

describe('koreaScreenerUniverse', () => {
  it('has 80 unique symbols with kospi/kosdaq split near 30/50', () => {
    const symbols = KOREA_SCREENER_UNIVERSE_ENTRIES.map((e) => e.symbol);
    assert.equal(symbols.length, 80);
    assert.equal(new Set(symbols).size, 80);
    const kospi = KOREA_SCREENER_UNIVERSE_ENTRIES.filter((e) => e.venue === 'kospi').length;
    const kosdaq = KOREA_SCREENER_UNIVERSE_ENTRIES.filter((e) => e.venue === 'kosdaq').length;
    assert.equal(kospi + kosdaq, 80);
    assert.ok(kospi >= 30 && kospi <= 45, `kospi=${kospi}`);
    assert.ok(kosdaq >= 35 && kosdaq <= 50, `kosdaq=${kosdaq}`);
  });

  it('maps kosdaq to .KQ and kospi to .KS', () => {
    assert.equal(yahooSymbolForVenue('247540', 'kosdaq'), '247540.KQ');
    assert.equal(yahooSymbolForVenue('005930', 'kospi'), '005930.KS');
    const map = koreaScreenerVenueMap();
    assert.equal(map.get('247540'), 'kosdaq');
    assert.equal(map.get('005930'), 'kospi');
  });
});
