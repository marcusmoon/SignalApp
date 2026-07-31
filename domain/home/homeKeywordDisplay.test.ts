import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHomeKeywordSymbolNames,
  homeKeywordChipLabel,
  homeKeywordIsSymbolChip,
  homeKeywordSymbolKey,
  isUsableCompanyName,
} from './homeKeywordDisplay.ts';

describe('homeKeywordSymbolKey', () => {
  it('strips yahoo KR suffix', () => {
    assert.equal(homeKeywordSymbolKey('005930.KS'), '005930');
    assert.equal(homeKeywordSymbolKey('000660.kq'), '000660');
  });
});

describe('isUsableCompanyName', () => {
  it('rejects ticker-like names', () => {
    assert.equal(isUsableCompanyName('005930', '005930'), false);
    assert.equal(isUsableCompanyName('005930.KS', '005930'), false);
    assert.equal(isUsableCompanyName('삼성전자', '005930'), true);
  });
});

describe('buildHomeKeywordSymbolNames', () => {
  it('maps company and quote names with normalized keys', () => {
    const map = buildHomeKeywordSymbolNames({
      companies: [{ symbol: '005930.KS', name: '삼성전자' }],
      quotes: [
        { symbol: '005930', name: 'Samsung' },
        { symbol: 'AAPL', name: 'Apple' },
        { symbol: '000660', name: '000660' },
      ],
    });
    assert.equal(map.get('005930'), '삼성전자');
    assert.equal(map.get('AAPL'), 'Apple');
    assert.equal(map.has('000660'), false);
  });
});

describe('homeKeywordChipLabel', () => {
  it('uses company name for symbols', () => {
    const names = new Map([['005930', '삼성전자']]);
    assert.equal(
      homeKeywordChipLabel({ label: '005930', kind: 'symbol', weight: 1 }, names),
      '삼성전자',
    );
  });

  it('resolves KR code themes via the name map', () => {
    const names = new Map([['005930', '삼성전자']]);
    assert.equal(
      homeKeywordChipLabel({ label: '005930.KS', kind: 'theme', weight: 1 }, names),
      '삼성전자',
    );
  });

  it('keeps theme labels as-is', () => {
    assert.equal(
      homeKeywordChipLabel({ label: 'HBM', kind: 'theme', weight: 1 }, new Map()),
      'HBM',
    );
  });

  it('prefers embedded keyword name over map', () => {
    const names = new Map([['005930', '삼성전자']]);
    assert.equal(
      homeKeywordChipLabel(
        { label: '005930', kind: 'symbol', weight: 1, name: '삼전' },
        names,
      ),
      '삼전',
    );
  });

  it('ignores embedded ticker-like names', () => {
    const names = new Map([['005930', '삼성전자']]);
    assert.equal(
      homeKeywordChipLabel(
        { label: '005930', kind: 'symbol', weight: 1, name: '005930.KS' },
        names,
      ),
      '삼성전자',
    );
  });
});

describe('homeKeywordIsSymbolChip', () => {
  it('treats KR code labels as symbol chips', () => {
    assert.equal(homeKeywordIsSymbolChip({ label: '005930', kind: 'theme', weight: 1 }), true);
    assert.equal(homeKeywordIsSymbolChip({ label: 'HBM', kind: 'theme', weight: 1 }), false);
  });
});
