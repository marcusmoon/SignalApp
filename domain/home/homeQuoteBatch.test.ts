/**
 * Home quote batch symbol list.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildHomeQuoteBatchSymbols } from './homeQuoteBatch.ts';

describe('buildHomeQuoteBatchSymbols', () => {
  it('dedupes and preserves first-seen order', () => {
    assert.deepEqual(
      buildHomeQuoteBatchSymbols(['AAPL', 'MSFT'], ['^GSPC', 'AAPL'], ['USDKRW=X']),
      ['AAPL', 'MSFT', '^GSPC', 'USDKRW=X'],
    );
  });

  it('handles empty watchlist', () => {
    assert.deepEqual(buildHomeQuoteBatchSymbols([], ['^IXIC'], ['EURUSD=X']), ['^IXIC', 'EURUSD=X']);
  });
});
