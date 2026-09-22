import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDigestRevision, validateDigestPredecessor } from './digestRevision.mjs';

const now = '2026-09-21T12:00:00Z';
const input = () => ({
  storyId: 'global:company:guidance-2026-q3', category: 'global', changeType: 'new',
  title: 'Guidance updated', summary: 'The company raised its guidance.',
  generatedAt: now, symbols: ['NVDA'],
  sourceRefs: [{ type: 'news', id: 'news:1', relation: 'primary' }],
  changes: [{ text: 'New guidance was announced.', sourceIds: ['news:1'] }],
});

test('revision identity ignores generated time, rank, and supplied id', () => {
  const first = normalizeDigestRevision(input(), 0, now);
  const second = normalizeDigestRevision({ ...input(), id: 'fake', generatedAt: '2026-09-21T11:00:00Z' }, 2, now);
  assert.equal(first.id, second.id);
  assert.notEqual(first.score, second.score);
});
test('evidence must be selected and nonempty; UTC and bounds are enforced', () => {
  for (const patch of [
    { changes: [] }, { changes: [{ text: 'Claim', sourceIds: ['unselected'] }] },
    { sourceRefs: [] }, { generatedAt: '2026-09-21' },
    { generatedAt: '2026-09-22T00:00:00Z' }, { category: 'invalid' },
    { changeType: 'update' }, { previousDigestId: 'old' },
  ]) assert.throws(() => normalizeDigestRevision({ ...input(), ...patch }, 0, now));
});
test('new stories cannot overwrite existing stories', () => {
  const first = normalizeDigestRevision(input(), 0, now);
  assert.doesNotThrow(() => validateDigestPredecessor(first, undefined));
  assert.throws(() => validateDigestPredecessor(first, first), /STORY_CHANGED/);
});
test('updates require current predecessor and changed facts', () => {
  const first = normalizeDigestRevision(input(), 0, now);
  const update = normalizeDigestRevision({ ...input(), changeType: 'update', previousDigestId: first.id,
    summary: 'Revised guidance is confirmed.' }, 0, now);
  assert.doesNotThrow(() => validateDigestPredecessor(update, first));
  assert.throws(() => validateDigestPredecessor(update, undefined), /NOT_FOUND/);
  assert.throws(() => validateDigestPredecessor(update, { ...first, id: 'newer' }), /STORY_CHANGED/);
  assert.throws(() => validateDigestPredecessor({ ...update, summary: first.summary }, first), /NO_MATERIAL_CHANGE/);
});
