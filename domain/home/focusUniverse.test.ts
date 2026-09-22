import test from 'node:test';
import assert from 'node:assert/strict';
import { FOCUS_TARGETS, focusSymbols, focusTargetNames } from './focusUniverse.ts';
import { matchingWatchSymbols } from './newsReading.ts';

test('focus scope contains exactly the ten requested targets, not the quote watchlist', () => {
  assert.equal(FOCUS_TARGETS.length, 10);
  assert.deepEqual(FOCUS_TARGETS.map((target) => target.id), ['samsung', 'sk-hynix', 'nvidia', 'apple', 'google', 'tesla', 'spacex', 'spy', 'qqq', 'bitmine']);
  assert.deepEqual(focusSymbols('spacex'), ['SPCX']);
  assert.deepEqual(focusSymbols('bitmine'), ['BMNR']);
  assert.deepEqual(focusSymbols('unknown'), []);
  assert.equal(focusSymbols().includes('BTC-USD'), false);
});

test('company aliases retain identity without partial ticker matches', () => {
  assert.deepEqual(focusTargetNames(['005930.KS', 'KRX:000660', 'GOOG', 'GOOGL'], 'ko'), ['삼성전자', 'SK하이닉스', '구글']);
  assert.deepEqual(focusTargetNames(['BMNR', 'SPCX'], 'en'), ['SpaceX', 'Bitmine']);
  assert.deepEqual(matchingWatchSymbols({ symbols: ['GOOGL'] }, focusSymbols('google')), ['GOOGL']);
  assert.deepEqual(matchingWatchSymbols({ symbols: ['NVDAW', 'SPYI'] }, focusSymbols()), []);
});
