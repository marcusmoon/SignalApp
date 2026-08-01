import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { fetchYahooIndexMarketQuotes } from './yahooIndexQuotes.mjs';

describe('fetchYahooIndexMarketQuotes', () => {
  it('normalizes caret symbols and skips invalid rows', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async (url) => {
      const path = String(url);
      const isSpx = path.includes('%5EGSPC') || path.includes('^GSPC');
      const body = JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: isSpx ? 5000.25 : null,
                regularMarketTime: isSpx ? 1785555035 : null,
                shortName: isSpx ? 'S&P 500' : 'Bad',
                currency: 'USD',
              },
              indicators: {
                quote: [{ close: isSpx ? [4900, 5000.25] : [null, null] }],
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
      const rows = await fetchYahooIndexMarketQuotes({
        symbols: ['^GSPC', 'AAPL', '^gspc', ''],
        segment: 'indices',
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].symbol, '^GSPC');
      assert.equal(rows[0].segment, 'indices');
      assert.equal(rows[0].provider, 'yahoo');
      assert.equal(rows[0].currentPrice, 5000.25);
      assert.equal(rows[0].quoteTime, '2026-08-01T03:30:35.000Z');
      assert.notEqual(rows[0].quoteTime, rows[0].fetchedAt);
      assert.ok(typeof rows[0].changePercent === 'number');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
