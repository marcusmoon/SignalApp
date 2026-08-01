import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { fetchYahooQuote, resolveYahooPreviousClose } from './yahooQuote.mjs';

describe('resolveYahooPreviousClose', () => {
  it('ignores stale chartPreviousClose and uses the previous daily close for US indexes', () => {
    const previousClose = resolveYahooPreviousClose(
      {
        close: [7509.2, 7498.96, 7408.3, 7411.98, 7413.18],
      },
    );

    assert.equal(previousClose, 7411.98);
  });

  it('uses the previous daily close when the latest bar is null during an open session', () => {
    const previousClose = resolveYahooPreviousClose(
      {
        close: [6747.95, 6797.7, 7096.89, 6690.62, null],
      },
    );

    assert.equal(previousClose, 6690.62);
  });
});

describe('fetchYahooQuote', () => {
  it('falls back to chartPreviousClose when FX chart has only one bar', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 212.845,
                  chartPreviousClose: 210.384,
                  regularMarketTime: 1785556823,
                  shortName: 'CNY/KRW',
                  currency: 'KRW',
                },
                indicators: {
                  quote: [{ close: [212.845], volume: [0] }],
                },
              },
            ],
          },
        }),
    }));

    try {
      const quote = await fetchYahooQuote('CNYKRW=X');
      assert.equal(quote?.previousClose, 210.384);
      assert.equal(quote?.changePercent, 1.17);
      assert.equal(quote?.marketTime, '2026-08-01T04:00:23.000Z');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
