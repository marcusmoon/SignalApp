import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  cachedPublicRead,
  clearPublicReadCache,
  clearPublicReadCacheByNamespaces,
  publicReadCache,
} from './publicReadCache.mjs';

describe('publicReadCache', () => {
  beforeEach(() => {
    clearPublicReadCache();
  });

  it('coalesces concurrent misses (singleflight)', async () => {
    let calls = 0;
    const slow = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { calls };
    };
    const [a, b] = await Promise.all([
      cachedPublicRead('publicNews', { q: 'x' }, slow, 5000),
      cachedPublicRead('publicNews', { q: 'x' }, slow, 5000),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
    assert.equal(publicReadCache.size, 1);
  });

  it('clearPublicReadCacheByNamespaces only drops matching prefixes', async () => {
    await cachedPublicRead('publicNews', { a: 1 }, async () => 1, 5000);
    await cachedPublicRead('publicCalendar', { a: 1 }, async () => 2, 5000);
    await cachedPublicRead('publicYoutube', {}, async () => 3, 5000);
    clearPublicReadCacheByNamespaces(['publicNews', 'publicYoutube']);
    const keys = [...publicReadCache.keys()];
    assert.equal(keys.length, 1);
    assert.ok(keys[0].startsWith('publicCalendar:'));
  });

  it('clearPublicReadCache wipes everything', async () => {
    await cachedPublicRead('publicNews', {}, async () => 1, 5000);
    clearPublicReadCache();
    assert.equal(publicReadCache.size, 0);
  });
});
