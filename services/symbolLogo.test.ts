/**
 * 심볼 로고 URL 후보 — 서버 제공 URL만 (클라이언트 Parqet 합성 없음).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { symbolLogoUrls } from './symbolLogo.ts';

describe('symbolLogoUrls', () => {
  it('uses only server imageUrl', () => {
    const urls = symbolLogoUrls('BTC', ['https://assets.coingecko.com/coins/images/1/large/bitcoin.png']);
    assert.deepEqual(urls, ['https://assets.coingecko.com/coins/images/1/large/bitcoin.png']);
  });

  it('returns empty when no server url (no client Parqet)', () => {
    assert.deepEqual(symbolLogoUrls('005930'), []);
    assert.deepEqual(symbolLogoUrls('AAPL'), []);
    assert.deepEqual(symbolLogoUrls('005930.KS'), []);
  });

  it('ignores non-http preferred urls', () => {
    assert.deepEqual(symbolLogoUrls('ETH', ['not-a-url', '']), []);
  });

  it('keeps first valid http url among preferred', () => {
    assert.deepEqual(
      symbolLogoUrls('AAPL', ['', 'not-a-url', 'https://assets.parqet.com/logos/symbol/AAPL']),
      ['https://assets.parqet.com/logos/symbol/AAPL'],
    );
  });
});
