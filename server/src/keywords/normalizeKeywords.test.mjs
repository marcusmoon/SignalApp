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

  it('keeps short why/reason for home rank context', () => {
    assert.deepEqual(
      normalizeKeywords([
        { label: 'HBM', kind: 'theme', weight: 0.9, why: '공급 차질' },
        { kind: 'symbol', symbol: '005930', name: '삼성전자', reason: '실적 호조' },
      ]),
      [
        { label: 'HBM', kind: 'theme', weight: 0.9, why: '공급 차질' },
        { label: '005930', kind: 'symbol', weight: 1, name: '삼성전자', why: '실적 호조' },
      ],
    );
  });

  it('strips yahoo KR suffix and drops ticker-like names', () => {
    assert.deepEqual(
      normalizeKeywords([
        { kind: 'symbol', symbol: '005930.KS', name: '005930', weight: 0.9 },
        { kind: 'symbol', symbol: '000660.KS', name: 'SK하이닉스', weight: 0.8 },
      ]),
      [
        { label: '005930', kind: 'symbol', weight: 0.9 },
        { label: '000660', kind: 'symbol', weight: 0.8, name: 'SK하이닉스' },
      ],
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
