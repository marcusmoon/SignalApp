import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import {
  fetchYahooFxMarketQuotes,
  normalizeYahooFxSymbol,
} from './yahooFxQuotes.mjs';

describe('normalizeYahooFxSymbol', () => {
  it('accepts AAA BBB =X pairs only', () => {
    assert.equal(normalizeYahooFxSymbol('usdkrw=x'), 'USDKRW=X');
    assert.equal(normalizeYahooFxSymbol('JPYKRW=X'), 'JPYKRW=X');
    assert.equal(normalizeYahooFxSymbol('^GSPC'), '');
    assert.equal(normalizeYahooFxSymbol('AAPL'), '');
    assert.equal(normalizeYahooFxSymbol('USDJPY'), '');
  });
});

describe('fetchYahooFxMarketQuotes', () => {
  it('normalizes FX symbols and skips invalid rows', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async (url) => {
      const path = String(url);
      const isUsd = path.includes('USDKRW%3DX') || path.includes('USDKRW=X');
      const body = JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: isUsd ? 1380.25 : null,
                regularMarketTime: isUsd ? 1785555035 : null,
                shortName: isUsd ? 'USD/KRW' : 'Bad',
                currency: 'KRW',
              },
              indicators: {
                quote: [{ close: isUsd ? [1370, 1380.25] : [null, null] }],
              },
            },
          ],
        },
      });
      return {
        ok: true,
        status: 200,
        text: async () => body,
      };
    });

    try {
      const rows = await fetchYahooFxMarketQuotes({
        symbols: ['USDKRW=X', 'AAPL', 'usdkrw=x', ''],
        segment: 'fx',
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].symbol, 'USDKRW=X');
      assert.equal(rows[0].segment, 'fx');
      assert.equal(rows[0].provider, 'yahoo');
      assert.equal(rows[0].currentPrice, 1380.25);
      assert.ok(typeof rows[0].changePercent === 'number');
      assert.equal(rows[0].quoteTime, '2026-08-01T03:30:35.000Z');
      assert.notEqual(rows[0].quoteTime, rows[0].fetchedAt);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
