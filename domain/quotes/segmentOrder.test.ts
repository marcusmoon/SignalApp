import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  migrateLegacyQuotesSegmentKey,
  normalizeQuotesSegmentOrder,
} from './segmentOrder.ts';

describe('migrateLegacyQuotesSegmentKey', () => {
  it('maps popular/mcap to etf', () => {
    assert.equal(migrateLegacyQuotesSegmentKey('popular'), 'etf');
    assert.equal(migrateLegacyQuotesSegmentKey('mcap'), 'etf');
    assert.equal(migrateLegacyQuotesSegmentKey('etf'), 'etf');
    assert.equal(migrateLegacyQuotesSegmentKey('watch'), 'watch');
    assert.equal(migrateLegacyQuotesSegmentKey('nope'), null);
  });
});

describe('normalizeQuotesSegmentOrder', () => {
  it('returns defaults for non-array', () => {
    assert.deepEqual(normalizeQuotesSegmentOrder(null), DEFAULT_QUOTES_SEGMENT_ORDER);
  });

  it('migrates popular+mcap to a single etf and fills missing keys', () => {
    assert.deepEqual(normalizeQuotesSegmentOrder(['coin', 'popular', 'mcap', 'watch']), [
      'coin',
      'etf',
      'watch',
    ]);
  });

  it('keeps known order and appends missing', () => {
    assert.deepEqual(normalizeQuotesSegmentOrder(['coin']), ['coin', 'watch', 'etf']);
  });
});
