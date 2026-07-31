import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { keywordsToTopicLabels, normalizeKeywords } from './normalizeKeywords.mjs';

describe('normalizeKeywords', () => {
  it('normalizes object and string entries', () => {
    assert.deepEqual(
      normalizeKeywords([
        { label: 'HBM', kind: 'theme', weight: 0.9 },
        '005930',
        { label: '#금리', kind: 'macro' },
      ]),
      [
        { label: 'HBM', kind: 'theme', weight: 0.9 },
        { label: '005930', kind: 'symbol', weight: 1 },
        { label: '금리', kind: 'macro', weight: 1 },
      ],
    );
  });

  it('drops banned and duplicate labels', () => {
    assert.deepEqual(
      normalizeKeywords(['시장', 'HBM', 'hbm', '뉴스', { label: 'HBM', kind: 'theme' }]),
      [{ label: 'HBM', kind: 'theme', weight: 1 }],
    );
  });

  it('caps length', () => {
    const many = Array.from({ length: 12 }, (_, i) => `키워드${i}`);
    assert.equal(normalizeKeywords(many).length, 6);
  });
});

describe('keywordsToTopicLabels', () => {
  it('maps labels for legacy topics trail', () => {
    assert.deepEqual(
      keywordsToTopicLabels([{ label: 'AI', kind: 'theme' }, 'NVDA']),
      ['AI', 'NVDA'],
    );
  });
});
