/**
 * Home sector-flow lead picker.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { etfHomeLeadText } from './etfHomeLead.ts';

function insight(partial: {
  summary?: string;
  rotation?: Record<string, unknown> | null;
}) {
  return {
    id: 'e1',
    period: 'weekly',
    title: 'Title',
    summary: partial.summary ?? '',
    insightDate: '2026-08-01',
    publishedAt: null,
    heatmap: [],
    themes: [],
    flowHighlights: [],
    rotation: partial.rotation ?? null,
    insights: [],
    sourceRefs: [],
  };
}

describe('etfHomeLeadText', () => {
  it('prefers summary', () => {
    assert.equal(
      etfHomeLeadText(
        insight({
          summary: '반도체로 수급이 이동했다.',
          rotation: { from: '금융', to: '반도체' },
        }),
      ),
      '반도체로 수급이 이동했다.',
    );
  });

  it('falls back to rotation from → to', () => {
    assert.equal(
      etfHomeLeadText(insight({ summary: '  ', rotation: { from: '금융', to: '반도체' } })),
      '금융 → 반도체',
    );
  });

  it('returns empty when nothing usable', () => {
    assert.equal(etfHomeLeadText(insight({})), '');
  });
});
