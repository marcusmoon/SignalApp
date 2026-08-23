/**
 * 홈 바로가기 정규화 — 레거시 마이그레이션 · 최대 6 · 빈 배열 · 중복 제거.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOME_SHORTCUTS_DEFAULT_NORMALIZED,
  HOME_SHORTCUTS_MAX,
  addHomeShortcutRaw,
  normalizeHomeShortcutsRaw,
} from './normalizeHomeShortcuts.ts';

describe('normalizeHomeShortcutsRaw', () => {
  it('returns defaults for non-array input', () => {
    assert.deepEqual(normalizeHomeShortcutsRaw(null), HOME_SHORTCUTS_DEFAULT_NORMALIZED);
    assert.deepEqual(normalizeHomeShortcutsRaw(undefined), HOME_SHORTCUTS_DEFAULT_NORMALIZED);
  });

  it('keeps empty array as empty strip (regression: [] became defaults)', () => {
    assert.deepEqual(normalizeHomeShortcutsRaw([]), []);
  });

  it('migrates legacy string shortcuts', () => {
    assert.deepEqual(normalizeHomeShortcutsRaw(['board', 'newsIt', 'etf']), [
      { type: 'board', source: 'all' },
      { type: 'news', segment: 'it' },
      { type: 'etf' },
    ]);
  });

  it('drops communityPost and dedupes by stable id', () => {
    const out = normalizeHomeShortcutsRaw([
      { type: 'communityPost', id: 'x' },
      { type: 'quotes', segment: 'watch' },
      { type: 'quotes', segment: 'watch' },
      { type: 'news', segment: 'global' },
    ]);
    assert.deepEqual(out, [
      { type: 'quotes', segment: 'watch' },
      { type: 'news', segment: 'global' },
    ]);
  });

  it(`caps at ${HOME_SHORTCUTS_MAX}`, () => {
    const raw = [
      { type: 'board', source: 'all' },
      { type: 'quotes', segment: 'watch' },
      { type: 'news', segment: 'global' },
      { type: 'calendar' },
      { type: 'etf' },
      { type: 'disclosures' },
      { type: 'settings' },
      { type: 'news', segment: 'korea' },
    ];
    const out = normalizeHomeShortcutsRaw(raw);
    assert.equal(out.length, HOME_SHORTCUTS_MAX);
    assert.equal(out[out.length - 1]?.type, 'disclosures');
    assert.ok(!out.some((row) => row.type === 'settings'));
  });

  it('falls back invalid segments/sources', () => {
    assert.deepEqual(normalizeHomeShortcutsRaw([{ type: 'board', source: 'save_user_news' }]), [
      { type: 'board', source: 'all' },
    ]);
    assert.deepEqual(normalizeHomeShortcutsRaw([{ type: 'board', source: 'nope' }]), [
      { type: 'board', source: 'all' },
    ]);
    assert.deepEqual(normalizeHomeShortcutsRaw([{ type: 'quotes', segment: 'xyz' }]), [
      { type: 'quotes', segment: 'watch' },
    ]);
    assert.deepEqual(normalizeHomeShortcutsRaw([{ type: 'news', segment: 'xyz' }]), [
      { type: 'news', segment: 'all' },
    ]);
  });

  it('migrates quotes popular/mcap to etf and dedupes', () => {
    assert.deepEqual(
      normalizeHomeShortcutsRaw([
        { type: 'quotes', segment: 'popular' },
        { type: 'quotes', segment: 'mcap' },
        { type: 'quotes', segment: 'etf' },
      ]),
      [{ type: 'quotes', segment: 'etf' }],
    );
  });

  it('accepts news segment all', () => {
    assert.deepEqual(normalizeHomeShortcutsRaw([{ type: 'news', segment: 'all' }]), [
      { type: 'news', segment: 'all' },
    ]);
  });
});

describe('addHomeShortcutRaw', () => {
  it('does not exceed max or duplicate', () => {
    const six = normalizeHomeShortcutsRaw([
      { type: 'board', source: 'all' },
      { type: 'quotes', segment: 'watch' },
      { type: 'news', segment: 'global' },
      { type: 'calendar' },
      { type: 'etf' },
      { type: 'disclosures' },
    ]);
    assert.equal(six.length, 6);
    assert.equal(addHomeShortcutRaw(six, { type: 'settings' }), six);
    assert.deepEqual(addHomeShortcutRaw([{ type: 'etf' }], { type: 'etf' }), [{ type: 'etf' }]);
  });
});
