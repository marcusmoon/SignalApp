/**
 * 브리핑 상세 시간 — publishedAt 체인 · date-only noon UTC.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { briefingDetailPublishedIso } from './publishedIso.ts';

describe('briefingDetailPublishedIso', () => {
  it('prefers publishedAt → generatedAt → updatedAt → createdAt', () => {
    assert.equal(
      briefingDetailPublishedIso({
        publishedAt: '2024-06-01T01:00:00.000Z',
        generatedAt: '2024-06-01T02:00:00.000Z',
      }),
      '2024-06-01T01:00:00.000Z',
    );
    assert.equal(
      briefingDetailPublishedIso({
        publishedAt: '  ',
        generatedAt: '2024-06-01T02:00:00.000Z',
      }),
      '2024-06-01T02:00:00.000Z',
    );
    assert.equal(
      briefingDetailPublishedIso({
        updatedAt: '2024-06-01T03:00:00.000Z',
        createdAt: '2024-06-01T04:00:00.000Z',
      }),
      '2024-06-01T03:00:00.000Z',
    );
  });

  it('falls back to briefingDate/insightDate noon UTC', () => {
    assert.equal(
      briefingDetailPublishedIso({ briefingDate: '2024-06-01' }),
      '2024-06-01T12:00:00.000Z',
    );
    assert.equal(
      briefingDetailPublishedIso({ insightDate: '2024-07-15' }),
      '2024-07-15T12:00:00.000Z',
    );
  });

  it('returns null for empty item', () => {
    assert.equal(briefingDetailPublishedIso(null), null);
    assert.equal(briefingDetailPublishedIso({}), null);
  });
});
