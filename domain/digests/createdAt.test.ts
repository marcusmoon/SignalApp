/**
 * 다이제스트 시간 — generatedAt → sourceRefs → generatedDate noon UTC.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { disclosureDigestCreatedIso, newsDigestCreatedIso } from './createdAt.ts';

describe('newsDigestCreatedIso', () => {
  it('uses generatedAt first', () => {
    assert.equal(
      newsDigestCreatedIso({
        generatedAt: '2024-05-01T10:00:00.000Z',
        sourceRefs: [{ publishedAt: '2024-05-01T09:00:00.000Z' }],
        generatedDate: '2024-05-01',
      }),
      '2024-05-01T10:00:00.000Z',
    );
  });

  it('falls back to first sourceRefs publishedAt (regression: missing generatedAt)', () => {
    assert.equal(
      newsDigestCreatedIso({
        sourceRefs: [{ publishedAt: '2024-05-01T09:00:00.000Z' }],
        generatedDate: '2024-05-01',
      }),
      '2024-05-01T09:00:00.000Z',
    );
  });

  it('falls back to generatedDate noon UTC', () => {
    assert.equal(newsDigestCreatedIso({ generatedDate: '2024-05-01' }), '2024-05-01T12:00:00.000Z');
    assert.equal(newsDigestCreatedIso({}), null);
  });
});

describe('disclosureDigestCreatedIso', () => {
  it('falls back to filedAt then generatedDate', () => {
    assert.equal(
      disclosureDigestCreatedIso({
        sourceRefs: [{ filedAt: '2024-05-02T08:00:00.000Z' }],
      }),
      '2024-05-02T08:00:00.000Z',
    );
    assert.equal(
      disclosureDigestCreatedIso({ generatedDate: '2024-05-02' }),
      '2024-05-02T12:00:00.000Z',
    );
  });
});
