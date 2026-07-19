/**
 * ETF 홈 카드 — 선택일 기준 7일 게이트.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldShowEtfBriefingOnHome } from './etfHomeVisibilityRules.ts';

describe('shouldShowEtfBriefingOnHome', () => {
  it('shows when insightDate is within 7 days of selectedYmd', () => {
    assert.equal(shouldShowEtfBriefingOnHome('2024-06-01', '2024-06-01'), true);
    assert.equal(shouldShowEtfBriefingOnHome('2024-06-01', '2024-06-08'), true);
  });

  it('hides when older than 7 days (regression: stale weekly card stuck on home)', () => {
    assert.equal(shouldShowEtfBriefingOnHome('2024-06-01', '2024-06-09'), false);
  });

  it('hides future insightDate and invalid inputs', () => {
    assert.equal(shouldShowEtfBriefingOnHome('2024-06-10', '2024-06-01'), false);
    assert.equal(shouldShowEtfBriefingOnHome(null, '2024-06-01'), false);
    assert.equal(shouldShowEtfBriefingOnHome('bad', '2024-06-01'), false);
  });
});
