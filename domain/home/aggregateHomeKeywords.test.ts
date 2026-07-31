import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aggregateHomeKeywords,
  groupHomeKeywords,
  homeKeywordSymbolsMissingNames,
  keywordsFromTopics,
} from './aggregateHomeKeywords.ts';

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

  it('carries symbol display names and promotes 6-digit topics', () => {
    const chips = aggregateHomeKeywords({
      todayKeywords: [{ kind: 'symbol', symbol: '005930', name: '삼성전자' }],
      digestRows: [{ id: 'd1', topics: ['000660'] }],
    });
    const samsung = chips.find((c) => c.label === '005930');
    const sk = chips.find((c) => c.label === '000660');
    assert.equal(samsung?.kind, 'symbol');
    assert.equal(samsung?.name, '삼성전자');
    assert.equal(sk?.kind, 'symbol');
  });
});

describe('groupHomeKeywords', () => {
  it('groups by kind in display order and skips empty kinds', () => {
    const groups = groupHomeKeywords([
      { label: '금리', kind: 'macro', weight: 1 },
      { label: 'HBM', kind: 'theme', weight: 1 },
      { label: '005930', kind: 'symbol', weight: 1 },
      { label: '실적', kind: 'event', weight: 1 },
      { label: 'AI', kind: 'theme', weight: 0.8 },
    ]);
    assert.deepEqual(
      groups.map((g) => g.kind),
      ['theme', 'symbol', 'macro', 'event'],
    );
    assert.deepEqual(
      groups[0]?.items.map((c) => c.label),
      ['HBM', 'AI'],
    );
  });
});

describe('keywordsFromTopics', () => {
  it('maps string topics', () => {
    assert.deepEqual(keywordsFromTopics(['A', 'B']), [
      { label: 'A', kind: 'theme', weight: 1 },
      { label: 'B', kind: 'theme', weight: 1 },
    ]);
  });

  it('promotes 6-digit topic strings to symbol', () => {
    assert.deepEqual(keywordsFromTopics(['005930']), [
      { label: '005930', kind: 'symbol', weight: 1 },
    ]);
  });
});

describe('homeKeywordSymbolsMissingNames', () => {
  it('lists symbol tickers without embedded names', () => {
    assert.deepEqual(
      homeKeywordSymbolsMissingNames([
        { label: 'HBM', kind: 'theme', weight: 1 },
        { label: '005930', kind: 'symbol', weight: 1, name: '삼성전자' },
        { label: '000660', kind: 'symbol', weight: 1 },
      ]),
      ['000660'],
    );
  });
});
