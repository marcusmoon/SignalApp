import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveYahooPreviousClose } from './yahooQuote.mjs';

describe('resolveYahooPreviousClose', () => {
  it('prefers Yahoo chartPreviousClose for index quotes when daily bars skip a trading day', () => {
    const previousClose = resolveYahooPreviousClose(
      {
        regularMarketPrice: 6755.75,
        chartPreviousClose: 6690.62,
      },
      {
        close: [6747.95, 6797.7, 7096.89, 6755.75],
      },
      6755.75,
    );

    assert.equal(previousClose, 6690.62);
  });

  it('falls back to the latest close that is not the current regularMarketPrice', () => {
    const previousClose = resolveYahooPreviousClose(
      {},
      {
        close: [6747.95, 6797.7, 7096.89, 6690.62, 6755.75],
      },
      6755.75,
    );

    assert.equal(previousClose, 6690.62);
  });
});
