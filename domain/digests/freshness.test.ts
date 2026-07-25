import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isDigestFresh,
  isHomeNewsFlowNew,
  getDigestAgeMs,
  DIGEST_FRESH_THRESHOLD_MS,
  HOME_NEWS_FLOW_NEW_THRESHOLD_MS,
} from './freshness.ts';

describe('domain/digests/freshness', () => {
  const now = Date.parse('2026-07-25T12:00:00.000Z');

  describe('isDigestFresh', () => {
    it('최근 생성된 다이제스트는 fresh', () => {
      assert.strictEqual(isDigestFresh(new Date(now).toISOString(), undefined, now), true);
    });

    it('1시간 전 생성은 fresh (기본 2시간 기준)', () => {
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(oneHourAgo, undefined, now), true);
    });

    it('2시간 전 생성은 fresh (경계값)', () => {
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(twoHoursAgo, undefined, now), true);
    });

    it('2시간 1분 전 생성은 fresh가 아님', () => {
      const overTwoHours = new Date(now - (2 * 60 * 60 * 1000 + 60 * 1000)).toISOString();
      assert.strictEqual(isDigestFresh(overTwoHours, undefined, now), false);
    });

    it('null·빈·잘못된 입력은 fresh가 아님', () => {
      assert.strictEqual(isDigestFresh(null, undefined, now), false);
      assert.strictEqual(isDigestFresh(undefined, undefined, now), false);
      assert.strictEqual(isDigestFresh('', undefined, now), false);
      assert.strictEqual(isDigestFresh('invalid-date', undefined, now), false);
    });

    it('미래 날짜는 fresh가 아님', () => {
      const future = new Date(now + 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(future, undefined, now), false);
    });

    it('커스텀 threshold 사용 가능', () => {
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      assert.strictEqual(isDigestFresh(oneHourAgo, 30 * 60 * 1000, now), false);
    });
  });

  describe('isHomeNewsFlowNew', () => {
    it('1시간 이내는 NEW', () => {
      const almostHour = new Date(now - (60 * 60 * 1000 - 1000)).toISOString();
      assert.strictEqual(isHomeNewsFlowNew(almostHour, now), true);
    });

    it('정확히 1시간은 NEW (경계)', () => {
      const oneHourAgo = new Date(now - HOME_NEWS_FLOW_NEW_THRESHOLD_MS).toISOString();
      assert.strictEqual(isHomeNewsFlowNew(oneHourAgo, now), true);
    });

    it('1시간 1분 전은 NEW 아님', () => {
      const over = new Date(now - (HOME_NEWS_FLOW_NEW_THRESHOLD_MS + 60 * 1000)).toISOString();
      assert.strictEqual(isHomeNewsFlowNew(over, now), false);
    });

    it('2시간 전은 리스트 fresh여도 홈 NEW는 아님', () => {
      const twoHoursAgo = new Date(now - DIGEST_FRESH_THRESHOLD_MS).toISOString();
      assert.strictEqual(isDigestFresh(twoHoursAgo, undefined, now), true);
      assert.strictEqual(isHomeNewsFlowNew(twoHoursAgo, now), false);
    });
  });

  describe('getDigestAgeMs', () => {
    it('경과 시간을 반환', () => {
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      assert.strictEqual(getDigestAgeMs(oneHourAgo, now), 60 * 60 * 1000);
    });

    it('잘못된 입력은 null', () => {
      assert.strictEqual(getDigestAgeMs(null, now), null);
      assert.strictEqual(getDigestAgeMs('invalid', now), null);
    });
  });

  describe('thresholds', () => {
    it('리스트 기본 2시간 · 홈 NEW 1시간', () => {
      assert.strictEqual(DIGEST_FRESH_THRESHOLD_MS, 2 * 60 * 60 * 1000);
      assert.strictEqual(HOME_NEWS_FLOW_NEW_THRESHOLD_MS, 60 * 60 * 1000);
    });
  });
});
