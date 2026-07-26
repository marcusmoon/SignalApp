import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { yahooCandidatesForKrx } from './yahooKrxQuotes.mjs';

describe('yahooCandidatesForKrx', () => {
  it('tries .KQ first for kosdaq and ignores conflicting .KS preferred', () => {
    assert.deepEqual(yahooCandidatesForKrx('247540', '247540.KS', 'kosdaq'), [
      '247540.KQ',
      '247540.KS',
    ]);
  });

  it('tries .KS first for kospi', () => {
    assert.deepEqual(yahooCandidatesForKrx('005930', null, 'kospi'), [
      '005930.KS',
      '005930.KQ',
    ]);
  });

  it('keeps matching preferred first', () => {
    assert.deepEqual(yahooCandidatesForKrx('247540', '247540.KQ', 'kosdaq'), [
      '247540.KQ',
      '247540.KS',
    ]);
  });
});
