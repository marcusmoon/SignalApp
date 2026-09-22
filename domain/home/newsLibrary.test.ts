import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSavedNews } from './newsLibrary.ts';

const item = { id: 'a', title: 'Headline', summary: 'Context', category: 'global', sourceRefs: [], sources: [], symbols: [] };

test('saved reading rejects corrupt entries and retains the most recently saved story revision', () => {
  const result = cleanSavedNews([null, {}, { item, savedAt: NaN },
    { item: { ...item, storyId: 'story', id: 'old' }, savedAt: 1 },
    { item: { ...item, storyId: 'story', id: 'new' }, savedAt: 2 }]);
  assert.deepEqual(result.map((row) => row.item.id), ['new']);
  assert.deepEqual(cleanSavedNews({}), []);
});

test('saved reading is bounded to one hundred most recent entries', () => {
  const result = cleanSavedNews(Array.from({ length: 110 }, (_, i) => ({ item: { ...item, id: String(i) }, savedAt: i })));
  assert.equal(result.length, 100);
  assert.equal(result[0].item.id, '109');
});
