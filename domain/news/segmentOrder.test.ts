import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NEWS_SEGMENT_ORDER } from '../../constants/newsSegment.ts';
import { normalizeNewsSegmentOrder } from './segmentOrder.ts';

describe('normalizeNewsSegmentOrder', () => {
  it('returns canonical order for non-array', () => {
    assert.deepEqual(normalizeNewsSegmentOrder(null), [...NEWS_SEGMENT_ORDER]);
  });

  it('resets legacy defaults that appended all at the end', () => {
    assert.deepEqual(
      normalizeNewsSegmentOrder(['global', 'korea', 'crypto', 'it', 'video', 'all']),
      [...NEWS_SEGMENT_ORDER],
    );
    assert.equal(normalizeNewsSegmentOrder(['global', 'korea', 'crypto', 'it', 'video', 'all'])[0], 'all');
  });

  it('resets pre-all stock default', () => {
    assert.deepEqual(
      normalizeNewsSegmentOrder(['global', 'korea', 'crypto', 'it', 'video']),
      [...NEWS_SEGMENT_ORDER],
    );
  });

  it('inserts missing all at the front of a custom order', () => {
    assert.deepEqual(normalizeNewsSegmentOrder(['korea', 'crypto']), [
      'all',
      'korea',
      'crypto',
      'global',
      'it',
      'video',
    ]);
  });

  it('keeps an intentional custom order that already includes all', () => {
    assert.deepEqual(normalizeNewsSegmentOrder(['korea', 'all', 'global', 'crypto', 'it', 'video']), [
      'korea',
      'all',
      'global',
      'crypto',
      'it',
      'video',
    ]);
  });
});
