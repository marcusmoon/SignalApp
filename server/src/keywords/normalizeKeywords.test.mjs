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
      normalizeKeywords(['시장', '나스닥', '^GSPC', 'HBM', 'hbm', '뉴스', { label: 'HBM', kind: 'theme' }]),
      [{ label: 'HBM', kind: 'theme', weight: 1 }],
    );
  });

  it('keeps specific themes, sectors, events and symbols', () => {
    assert.deepEqual(
      normalizeKeywords([
        { label: 'AI 데이터센터', kind: 'theme', weight: 0.95 },
        { label: '반도체 장비', kind: 'sector', weight: 0.82 },
        { label: 'FOMC', kind: 'event', weight: 0.8 },
        { label: 'NVDA', kind: 'symbol', weight: 0.7 },
      ]),
      [
        { label: 'AI 데이터센터', kind: 'theme', weight: 0.95 },
        { label: '반도체 장비', kind: 'sector', weight: 0.82 },
        { label: 'FOMC', kind: 'event', weight: 0.8 },
        { label: 'NVDA', kind: 'symbol', weight: 0.7 },
      ],
    );
  });

  it('caps length', () => {
    const many = Array.from({ length: 12 }, (_, i) => `키워드${i}`);
    assert.equal(normalizeKeywords(many).length, 6);
  });

  it('keeps symbol ticker in label and company name separately', () => {
    assert.deepEqual(
      normalizeKeywords([
        { kind: 'symbol', symbol: '005930', name: '삼성전자', weight: 0.9 },
      ]),
      [{ label: '005930', kind: 'symbol', weight: 0.9, name: '삼성전자' }],
    );
  });

  it('promotes 6-digit theme labels and keeps companion name', () => {
    assert.deepEqual(
      normalizeKeywords([{ label: '005930', kind: 'theme', name: '삼성전자' }]),
      [{ label: '005930', kind: 'symbol', weight: 1, name: '삼성전자' }],
    );
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
