import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeAutoHashtagsIntoNewsItem, normalizeNewsHashtagLabels } from './newsHashtags.mjs';

describe('news digest article tags', () => {
  it('normalizes concise tags and preserves ticker case', () => {
    assert.deepEqual(
      normalizeNewsHashtagLabels(['#AI 데이터센터', 'nvda', 'AI 데이터센터', ''], 5),
      ['AI 데이터센터', 'NVDA'],
    );
  });

  it('replaces only automatic article tags', () => {
    const automatic = { hashtagSource: 'auto', hashtags: [{ label: 'old', order: 0, source: 'auto' }] };
    mergeAutoHashtagsIntoNewsItem(automatic, ['엔비디아', 'AI 데이터센터']);
    assert.deepEqual(automatic.hashtags, [
      { label: '엔비디아', order: 0, source: 'auto' },
      { label: 'AI 데이터센터', order: 1, source: 'auto' },
    ]);

    const manual = { hashtagSource: 'manual', hashtags: [{ label: '보존', order: 0, source: 'manual' }] };
    mergeAutoHashtagsIntoNewsItem(manual, ['교체 금지']);
    assert.deepEqual(manual.hashtags, [{ label: '보존', order: 0, source: 'manual' }]);
  });
});
