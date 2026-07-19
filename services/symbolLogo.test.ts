/**
 * 심볼 로고 URL 후보 — 서버 imageUrl 우선 · Parqet 폴백.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { symbolLogoUrls } from './symbolLogo.ts';

describe('symbolLogoUrls', () => {
  it('prefers server imageUrl before Parqet (coins)', () => {
    const urls = symbolLogoUrls('BTC', ['https://assets.coingecko.com/coins/images/1/large/bitcoin.png']);
    assert.equal(urls[0], 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png');
    assert.ok(urls.some((u) => u.includes('parqet.com')));
  });

  it('uses Parqet KS/KQ for Korea stock codes', () => {
    const urls = symbolLogoUrls('005930');
    assert.deepEqual(urls, [
      'https://assets.parqet.com/logos/symbol/005930.KS',
      'https://assets.parqet.com/logos/symbol/005930.KQ',
    ]);
  });

  it('strips Yahoo .KS/.KQ so briefing symbols still resolve (regression)', () => {
    assert.deepEqual(symbolLogoUrls('005930.KS'), [
      'https://assets.parqet.com/logos/symbol/005930.KS',
      'https://assets.parqet.com/logos/symbol/005930.KQ',
    ]);
    assert.deepEqual(symbolLogoUrls('000660.KQ'), [
      'https://assets.parqet.com/logos/symbol/000660.KS',
      'https://assets.parqet.com/logos/symbol/000660.KQ',
    ]);
  });

  it('keeps US class-share dots (BRK.B) and strips .US only', () => {
    assert.equal(symbolLogoUrls('BRK.B')[0], 'https://assets.parqet.com/logos/symbol/BRK.B');
    assert.equal(symbolLogoUrls('AAPL.US')[0], 'https://assets.parqet.com/logos/symbol/AAPL');
  });

  it('ignores non-http preferred urls', () => {
    const urls = symbolLogoUrls('ETH', ['not-a-url', '']);
    assert.equal(urls[0], 'https://assets.parqet.com/logos/symbol/ETH');
  });
});
