import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateHomeKeywords, keywordsFromTopics } from './aggregateHomeKeywords.ts';

describe('aggregateHomeKeywords', () => {
  it('prefers today briefing over digest topics', () => {
    const chips = aggregateHomeKeywords({
      todayKeywords: [{ label: 'HBM', kind: 'theme', weight: 0.8 }],
      digestRows: [{ id: 'd1', topics: ['HBM', '금리'] }],
      limit: 5,
    });
    assert.equal(chips[0]?.label, 'HBM');
    assert.ok((chips[0]?.weight ?? 0) > 0.8);
    assert.equal(chips.some((c) => c.label === '금리'), true);
  });

  it('falls back to digest topics when keywords missing', () => {
    const chips = aggregateHomeKeywords({
      digestRows: [{ id: 'd1', topics: ['AI 반도체', 'NVDA'] }],
    });
    assert.deepEqual(
      chips.map((c) => c.label),
      ['AI 반도체', 'NVDA'],
    );
    assert.equal(chips[0]?.digestId, 'd1');
  });

  it('caps results', () => {
    const chips = aggregateHomeKeywords({
      todayKeywords: Array.from({ length: 10 }, (_, i) => ({
        label: `키워드${i}`,
        kind: 'theme',
        weight: 1,
      })),
      limit: 7,
    });
    assert.equal(chips.length, 7);
  });
});

describe('keywordsFromTopics', () => {
  it('maps string topics', () => {
    assert.deepEqual(keywordsFromTopics(['A', 'B']), [
      { label: 'A', kind: 'theme', weight: 1 },
      { label: 'B', kind: 'theme', weight: 1 },
    ]);
  });
});
