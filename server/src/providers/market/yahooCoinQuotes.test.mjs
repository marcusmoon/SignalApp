import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baseCryptoSymbol,
  coinLogoUrlForBase,
  fetchYahooCoinMarkets,
  normalizeYahooCryptoPair,
} from './yahooCoinQuotes.mjs';

test('normalizeYahooCryptoPair accepts base and pair forms', () => {
  assert.equal(normalizeYahooCryptoPair('btc'), 'BTC-USD');
  assert.equal(normalizeYahooCryptoPair('BTC-USD'), 'BTC-USD');
  assert.equal(normalizeYahooCryptoPair(''), '');
});

test('baseCryptoSymbol strips -USD', () => {
  assert.equal(baseCryptoSymbol('BTC-USD'), 'BTC');
  assert.equal(baseCryptoSymbol('eth'), 'ETH');
});

test('coinLogoUrlForBase maps majors', () => {
  assert.match(coinLogoUrlForBase('BTC'), /^https:\/\//);
  assert.equal(coinLogoUrlForBase('UNKNOWNCOIN'), null);
});

test('fetchYahooCoinMarkets maps quotes in list order', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const symbol = decodeURIComponent(href.split('/chart/')[1]?.split('?')[0] || '');
    const price = symbol === 'BTC-USD' ? 100 : 50;
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: price,
                  chartPreviousClose: price - 1,
                  shortName: symbol === 'BTC-USD' ? 'Bitcoin USD' : 'Ether USD',
                  currency: 'USD',
                  marketCap: symbol === 'BTC-USD' ? 2e12 : 4e11,
                  regularMarketTime: 1_700_000_000,
                },
                indicators: { quote: [{ close: [price - 1, price] }] },
              },
            ],
          },
        });
      },
    };
  };
  try {
    const rows = await fetchYahooCoinMarkets({ symbols: ['ETH', 'BTC-USD'] });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].symbol, 'ETH');
    assert.equal(rows[0].listPosition, 0);
    assert.equal(rows[0].provider, 'yahoo');
    assert.equal(rows[1].symbol, 'BTC');
    assert.equal(rows[1].listPosition, 1);
    assert.ok(rows[0].imageUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
