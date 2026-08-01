import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aggregateHomeKeywords,
  homeKeywordSymbolsMissingNames,
  keywordsFromTopics,
  resolveHomeKeywordsAsOfIso,
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

  it('promotes yahoo-suffixed KR codes and strips suffix', () => {
    const chips = aggregateHomeKeywords({
      digestRows: [{ id: 'd1', topics: ['005930.KS'] }],
    });
    assert.equal(chips[0]?.label, '005930');
    assert.equal(chips[0]?.kind, 'symbol');
  });

  it('carries why and defaults to strip limit of 6', () => {
    const chips = aggregateHomeKeywords({
      todayKeywords: [
        { label: 'HBM', kind: 'theme', weight: 1, why: '공급 이슈' },
        { label: 'A', kind: 'theme', weight: 0.9 },
        { label: 'B', kind: 'theme', weight: 0.8 },
        { label: 'C', kind: 'theme', weight: 0.7 },
        { label: 'D', kind: 'theme', weight: 0.6 },
        { label: 'E', kind: 'theme', weight: 0.5 },
        { label: 'F', kind: 'theme', weight: 0.4 },
      ],
    });
    assert.equal(chips.length, 6);
    assert.equal(chips[0]?.why, '공급 이슈');
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

describe('resolveHomeKeywordsAsOfIso', () => {
  it('picks newest timestamp among contributing sources only', () => {
    const iso = resolveHomeKeywordsAsOfIso({
      todayKeywords: [{ label: 'HBM', kind: 'theme', weight: 1 }],
      todayGeneratedAt: '2026-07-23T01:00:00.000Z',
      marketRows: [
        { keywords: [], at: '2026-07-23T09:00:00.000Z' },
        {
          keywords: [{ label: 'AI', kind: 'theme', weight: 1 }],
          at: '2026-07-23T03:00:00.000Z',
        },
      ],
      digestRows: [
        {
          topics: ['금리'],
          at: '2026-07-23T04:30:00.000Z',
        },
      ],
    });
    assert.equal(iso, '2026-07-23T04:30:00.000Z');
  });

  it('returns null when no contributing timestamps', () => {
    assert.equal(
      resolveHomeKeywordsAsOfIso({
        todayKeywords: [{ label: 'HBM', kind: 'theme', weight: 1 }],
        todayGeneratedAt: null,
      }),
      null,
    );
  });
});
