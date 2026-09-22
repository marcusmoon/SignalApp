import test from 'node:test';
import assert from 'node:assert/strict';
import { settleHomeSection } from './sectionLoading.ts';

test('fast content renders before a slower section completes', async () => {
  const applied: string[] = [];
  let release!: (value: string) => void;
  const options = {
    isCurrent: () => true,
    commit: (value: string) => applied.push(value),
    fail: () => assert.fail(),
    finish: () => {},
  };
  const slow = settleHomeSection(
    new Promise<string>((resolve) => {
      release = resolve;
    }),
    options,
  );
  await settleHomeSection(Promise.resolve('news'), options);
  assert.deepEqual(applied, ['news']);
  release('quotes');
  await slow;
  assert.deepEqual(applied, ['news', 'quotes']);
});

test('failed refresh keeps previous data and ends loading', async () => {
  let value = 'previous';
  let failed = false;
  let finished = false;
  await settleHomeSection(Promise.reject(new Error('offline')), {
    isCurrent: () => true,
    commit: (next: string) => {
      value = next;
    },
    fail: () => {
      failed = true;
    },
    finish: () => {
      finished = true;
    },
  });
  assert.equal(value, 'previous');
  assert.equal(failed, true);
  assert.equal(finished, true);
});

test('obsolete requests cannot change data, errors, or loading state', async () => {
  const changed = () => assert.fail('outdated request changed the current view');
  const options = { isCurrent: () => false, commit: changed, fail: changed, finish: changed };
  await settleHomeSection(Promise.resolve('yesterday'), options);
  await settleHomeSection(Promise.reject(new Error('old failure')), options);
});
