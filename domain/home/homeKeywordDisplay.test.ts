import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHomeKeywordSymbolNames,
  homeKeywordChipLabel,
} from './homeKeywordDisplay.ts';

describe('buildHomeKeywordSymbolNames', () => {
  it('maps company and quote names, first wins', () => {
    const map = buildHomeKeywordSymbolNames({
      companies: [{ symbol: '005930', name: '삼성전자' }],
      quotes: [
        { symbol: '005930', name: 'Samsung' },
        { symbol: 'AAPL', name: 'Apple' },
      ],
    });
    assert.equal(map.get('005930'), '삼성전자');
    assert.equal(map.get('AAPL'), 'Apple');
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

  it('keeps theme labels as-is', () => {
    assert.equal(
      homeKeywordChipLabel({ label: 'HBM', kind: 'theme', weight: 1 }, new Map()),
      'HBM',
    );
  });
});
