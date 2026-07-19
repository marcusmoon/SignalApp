/**
 * 뉴스 피드 — canonical URL 중복 제거 · 페이지네이션 전진.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appendUniqueNewsRows,
  dedupeNewsFeedRows,
  newsFeedCanonicalUrl,
  newsFeedDedupeKey,
} from './feedFilters.ts';

/** Minimal feed row — avoid @/ type imports under Node test runner. */
function row(partial: {
  id: string;
  sourceUrl?: string;
  title?: string;
  originalTitle?: string;
  sourceName?: string;
}) {
  return {
    id: partial.id,
    category: 'global',
    title: partial.title ?? 't',
    summary: '',
    originalTitle: partial.originalTitle ?? partial.title ?? 't',
    originalSummary: '',
    sourceName: partial.sourceName ?? 'Reuters',
    sourceUrl: partial.sourceUrl ?? '',
    symbols: [] as string[],
    provider: 'test',
    publishedAt: null as string | null,
    fetchedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('newsFeedCanonicalUrl', () => {
  it('strips utm_/tracking query noise', () => {
    const url = newsFeedCanonicalUrl(
      row({
        id: '1',
        sourceUrl: 'https://example.com/a?utm_source=x&keep=1&xy=1&oc=2#frag',
      }),
    );
    assert.equal(url, 'https://example.com/a?keep=1');
  });
});

describe('dedupeNewsFeedRows', () => {
  it('collapses same story URL with different tracking (regression: dup cards)', () => {
    const a = row({
      id: 'a',
      sourceUrl: 'https://ex.com/story?utm_campaign=1',
      title: 'A',
    });
    const b = row({
      id: 'b',
      sourceUrl: 'https://ex.com/story?utm_source=twitter',
      title: 'B',
    });
    const out = dedupeNewsFeedRows([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.id, 'a');
  });

  it('falls back to source:title when URL missing', () => {
    const a = row({ id: '1', sourceUrl: '', originalTitle: 'Hello  World', sourceName: 'BN' });
    const b = row({ id: '2', sourceUrl: '', originalTitle: 'Hello World', sourceName: 'BN' });
    assert.equal(newsFeedDedupeKey(a), newsFeedDedupeKey(b));
    assert.equal(dedupeNewsFeedRows([a, b]).length, 1);
  });
});

describe('appendUniqueNewsRows', () => {
  it('does not block pagination when provider resends URL dupes with new ids', () => {
    const existing = [row({ id: '1', sourceUrl: 'https://ex.com/a' })];
    const incoming = [
      row({ id: '2', sourceUrl: 'https://ex.com/a?utm_source=x' }),
      row({ id: '3', sourceUrl: 'https://ex.com/b' }),
    ];
    const { merged, addedCount } = appendUniqueNewsRows(existing, incoming);
    assert.equal(addedCount, 1);
    assert.equal(merged.length, 2);
    assert.equal(merged[1]?.id, '3');
  });
});
