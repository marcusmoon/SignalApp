/**
 * 홈 히어로 — 빈 오늘 정리 제외 · KST 회차 창.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fallbackSameDayTarget,
  hasTodayBriefingContent,
  kstMinutesSinceMidnight,
  preferredHeroTargetForKstMinutes,
  selectTodayHeroTarget,
} from './homeHeroRules.ts';

describe('hasTodayBriefingContent', () => {
  it('rejects null/empty shell (regression: blank today hero card)', () => {
    assert.equal(hasTodayBriefingContent(null), false);
    assert.equal(hasTodayBriefingContent({}), false);
    assert.equal(hasTodayBriefingContent({ headline: '  ', summary: '', keyPoints: [] }), false);
    assert.equal(hasTodayBriefingContent({ keyPoints: ['', '  '] }), false);
  });

  it('accepts headline, summary, or any non-empty key point', () => {
    assert.equal(hasTodayBriefingContent({ headline: '마감 정리' }), true);
    assert.equal(hasTodayBriefingContent({ summary: '요약' }), true);
    assert.equal(hasTodayBriefingContent({ keyPoints: ['포인트'] }), true);
  });
});

describe('preferredHeroTargetForKstMinutes', () => {
  it('maps KST windows: overnight → morning → lunch → close → today', () => {
    assert.deepEqual(preferredHeroTargetForKstMinutes(0), { market: 'us', session: 'overnight' });
    assert.deepEqual(preferredHeroTargetForKstMinutes(8 * 60 + 59), {
      market: 'us',
      session: 'overnight',
    });
    assert.deepEqual(preferredHeroTargetForKstMinutes(9 * 60), {
      market: 'kr',
      session: 'morning',
    });
    assert.deepEqual(preferredHeroTargetForKstMinutes(12 * 60 + 9), {
      market: 'kr',
      session: 'morning',
    });
    assert.deepEqual(preferredHeroTargetForKstMinutes(12 * 60 + 10), {
      market: 'kr',
      session: 'lunch',
    });
    assert.deepEqual(preferredHeroTargetForKstMinutes(15 * 60 + 29), {
      market: 'kr',
      session: 'lunch',
    });
    assert.deepEqual(preferredHeroTargetForKstMinutes(15 * 60 + 30), {
      market: 'kr',
      session: 'close',
    });
    assert.deepEqual(preferredHeroTargetForKstMinutes(22 * 60 + 59), {
      market: 'kr',
      session: 'close',
    });
    assert.equal(preferredHeroTargetForKstMinutes(23 * 60), 'today');
  });
});

describe('selectTodayHeroTarget', () => {
  it('advances to lunch when published during morning window (regression: stuck on pre-market)', () => {
    const preferred = preferredHeroTargetForKstMinutes(12 * 60 + 5);
    assert.deepEqual(preferred, { market: 'kr', session: 'morning' });
    assert.deepEqual(
      selectTodayHeroTarget(preferred, [
        { market: 'us', session: 'overnight' },
        { market: 'kr', session: 'morning' },
        { market: 'kr', session: 'lunch' },
      ]),
      { market: 'kr', session: 'lunch' },
    );
  });

  it('stays on morning when lunch is not yet available', () => {
    assert.deepEqual(
      selectTodayHeroTarget(
        { market: 'kr', session: 'morning' },
        [
          { market: 'us', session: 'overnight' },
          { market: 'kr', session: 'morning' },
        ],
      ),
      { market: 'kr', session: 'morning' },
    );
  });
});

describe('fallbackSameDayTarget', () => {
  it('falls back to close when today wrap is missing after 23:00 window', () => {
    const preferred = preferredHeroTargetForKstMinutes(23 * 60);
    assert.equal(preferred, 'today');
    assert.deepEqual(
      fallbackSameDayTarget(preferred, [{ market: 'kr', session: 'close' }]),
      { market: 'kr', session: 'close' },
    );
  });

  it('returns null when no same-day candidates exist', () => {
    assert.equal(
      fallbackSameDayTarget('today', []),
      null,
    );
  });
});

describe('kstMinutesSinceMidnight', () => {
  it('reads Asia/Seoul wall clock', () => {
    // 2024-01-15 00:30 KST = 2024-01-14 15:30 UTC
    const utc = new Date('2024-01-14T15:30:00.000Z');
    assert.equal(kstMinutesSinceMidnight(utc), 30);
  });
});
