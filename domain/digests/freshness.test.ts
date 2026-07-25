import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isDigestFresh, getDigestAgeMs, DIGEST_FRESH_THRESHOLD_MS } from './freshness.ts';

describe('domain/digests/freshness', () => {
  describe('isDigestFresh', () => {
    it('최근 생성된 다이제스트는 fresh', () => {
      const now = new Date().toISOString();
      assert.strictEqual(isDigestFresh(now), true);
    });

    it('1시간 전 생성은 fresh (기본 2시간 기준)', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(oneHourAgo), true);
    });

    it('2시간 전 생성은 fresh (경계값)', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(twoHoursAgo), true);
    });

    it('2시간 1분 전 생성은 fresh가 아님', () => {
      const overTwoHours = new Date(Date.now() - (2 * 60 * 60 * 1000 + 60 * 1000)).toISOString();
      assert.strictEqual(isDigestFresh(overTwoHours), false);
    });

    it('3시간 전 생성은 fresh가 아님', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(threeHoursAgo), false);
    });

    it('null 입력은 fresh가 아님', () => {
      assert.strictEqual(isDigestFresh(null), false);
    });

    it('undefined 입력은 fresh가 아님', () => {
      assert.strictEqual(isDigestFresh(undefined), false);
    });

    it('빈 문자열은 fresh가 아님', () => {
      assert.strictEqual(isDigestFresh(''), false);
    });

    it('잘못된 날짜 형식은 fresh가 아님', () => {
      assert.strictEqual(isDigestFresh('invalid-date'), false);
    });

    it('미래 날짜는 fresh가 아님', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(future), false);
    });

    it('커스텀 threshold 사용 가능', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const thirtyMinThreshold = 30 * 60 * 1000;
      assert.strictEqual(isDigestFresh(oneHourAgo, thirtyMinThreshold), false);
    });
  });

  describe('getDigestAgeMs', () => {
    it('최근 생성의 경과 시간은 0에 가까움', () => {
      const now = new Date().toISOString();
      const age = getDigestAgeMs(now);
      assert.ok(age !== null);
      assert.ok(age >= 0 && age < 1000);
    });

    it('1시간 전 생성의 경과 시간', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const age = getDigestAgeMs(oneHourAgo);
      assert.ok(age !== null);
      assert.ok(age >= 59 * 60 * 1000 && age <= 61 * 60 * 1000);
    });

    it('null 입력은 null 반환', () => {
      assert.strictEqual(getDigestAgeMs(null), null);
    });

    it('undefined 입력은 null 반환', () => {
      assert.strictEqual(getDigestAgeMs(undefined), null);
    });

    it('잘못된 날짜는 null 반환', () => {
      assert.strictEqual(getDigestAgeMs('invalid'), null);
    });
  });

  describe('DIGEST_FRESH_THRESHOLD_MS', () => {
    it('기본값은 2시간 (7200000ms)', () => {
      assert.strictEqual(DIGEST_FRESH_THRESHOLD_MS, 2 * 60 * 60 * 1000);
    });
  });
});
