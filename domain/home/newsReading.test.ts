import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasReadNews,
  matchingWatchSymbols,
  newsReadKey,
  newsReadRevision,
  pruneNewsReadHistory,
  selectHomeNews,
  type HomeNewsRow,
} from './newsReading.ts';

function row(
  id: string,
  symbols: string[] = [],
  generatedAt = '2026-09-07T01:00:00Z',
): HomeNewsRow {
  return {
    category: 'global',
    item: {
      id,
      category: 'global',
      title: `Story ${id}`,
      summary: 'Context',
      symbols,
      sources: [],
      topics: [],
      count: 1,
      generatedAt,
      generatedDate: '2026-09-07',
      primaryNewsId: null,
      sourceRefs: [],
    },
  };
}

test('watchlist matching uses exact declared symbols and Korean aliases', () => {
  assert.deepEqual(
    matchingWatchSymbols(row('1', ['NVDA', '005930.KS', '005930']).item, ['nvda', 'KRX:005930']),
    ['NVDA', '005930'],
  );
  assert.deepEqual(
    matchingWatchSymbols(row('NVDA mentioned only in title', ['NVDAW']).item, ['NVDA']),
    [],
  );
});

test('filter before limiting; sort UTC instants and dedupe IDs deterministically', () => {
  const rows = [
    row('newest', [], '2026-09-07T03:00:00Z'),
    row('watched', ['NVDA'], '2026-09-07T11:00:00+09:00'),
    row('older', ['AAPL']),
    row('watched', ['NVDA']),
  ];
  assert.deepEqual(
    selectHomeNews(rows, ['NVDA'], 'watch', 1).map((x) => x.item.id),
    ['watched'],
  );
  assert.deepEqual(
    selectHomeNews(rows, [], 'all', 10).map((x) => x.item.id),
    ['newest', 'watched', 'older'],
  );
  assert.equal(selectHomeNews(rows, [], 'watch', 10).length, 0);
  assert.equal(selectHomeNews(rows, [], 'all', 0).length, 0);
});

test('read markers are locale and revision specific, not a freshness timer', () => {
  const item = row('1').item;
  const history = {
    [newsReadKey(item.id, 'ko')]: { revision: newsReadRevision(item), readAt: Date.now() },
  };
  assert.equal(hasReadNews(history, item, 'ko'), true);
  assert.equal(hasReadNews(history, item, 'en'), false);
  assert.equal(hasReadNews(history, { ...item, summary: 'Updated context' }, 'ko'), false);
  assert.equal(hasReadNews(history, { ...item, generatedAt: '2026-09-07T02:00:00Z' }, 'ko'), false);
});

test('history is bounded and rejects corrupt local storage entries', () => {
  const history = Object.fromEntries(
    Array.from({ length: 320 }, (_, i) => [`ko:${i}`, { revision: 'v1', readAt: i }]),
  );
  const pruned = pruneNewsReadHistory({
    ...history,
    invalid: null,
    badTime: { revision: 'v1', readAt: 'yesterday' },
  });
  assert.equal(Object.keys(pruned).length, 300);
  assert.equal(pruned['ko:0'], undefined);
  assert.equal(pruned['ko:319'].readAt, 319);
  assert.deepEqual(pruneNewsReadHistory([]), {});
});

test('a story shows its latest revision and becomes unread only when revision changes', () => {
  const older = row('v1');
  older.item.storyId = 'global:nvda:earnings';
  older.item.revisionId = 'revision-one';
  const newer = row('v2', [], '2026-09-07T03:00:00Z');
  newer.item.storyId = older.item.storyId;
  newer.item.revisionId = 'revision-two';
  assert.deepEqual(selectHomeNews([older, newer], [], 'all', 10).map((r) => r.item.id), ['v2']);
  const history = { [newsReadKey(older.item.storyId, 'ko')]: { revision: 'revision-one', readAt: 1 } };
  assert.equal(hasReadNews(history, older.item, 'ko'), true);
  assert.equal(hasReadNews(history, newer.item, 'ko'), false);
  assert.equal(newsReadRevision({ ...older.item, generatedAt: newer.item.generatedAt }), 'revision-one');
});
