import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHomeKeywordSymbolNames,
  buildHomeKeywordSymbolProfiles,
  homeKeywordChipIdentity,
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
    // Global tickers stay ticker-only — no company name in the map.
    assert.equal(map.has('AAPL'), false);
    assert.equal(map.has('000660'), false);
  });

  it('prefers symbolMeta name and logo over legacy row fields for KR only', () => {
    const map = buildHomeKeywordSymbolProfiles({
      quotes: [
        {
          symbol: '005930',
          name: 'Wrong',
          symbolMeta: { name: '삼성전자', logoUrl: 'https://cdn.example/005930.png' },
        },
        {
          symbol: 'AAPL',
          name: 'Wrong',
          symbolMeta: { name: 'Apple Inc.', logoUrl: 'https://cdn.example/aapl.png' },
        },
      ],
    });
    assert.equal(map.get('005930')?.name, '삼성전자');
    assert.equal(map.get('005930')?.logoUrl, 'https://cdn.example/005930.png');
    assert.equal(map.get('AAPL')?.name, null);
    assert.equal(map.get('AAPL')?.logoUrl, 'https://cdn.example/aapl.png');
  });
});

describe('homeKeywordChipIdentity', () => {
  it('resolves KR code chips as code + company name', () => {
    const names = new Map([['005930', '삼성전자']]);
    const identity = homeKeywordChipIdentity({ label: '005930', kind: 'symbol', weight: 1 }, names);
    assert.equal(identity?.displaySymbol, '005930');
    assert.equal(identity?.displayName, '삼성전자');
  });

  it('resolves US symbol chips as tickers without a company-name suffix', () => {
    const names = new Map([['AAPL', '애플']]);
    const identity = homeKeywordChipIdentity(
      { label: 'AAPL', kind: 'symbol', weight: 1, name: '애플' },
      names,
    );
    assert.equal(identity?.displaySymbol, 'AAPL');
    assert.equal(identity?.displayName, null);
  });
});

describe('homeKeywordChipLabel', () => {
  it('uses the Korean company name for Korean stock-code symbols', () => {
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

  it('returns the ticker for US symbol chips in legacy label mode', () => {
    const names = new Map([['AAPL', 'Apple']]);
    assert.equal(
      homeKeywordChipLabel({ label: 'AAPL', kind: 'symbol', weight: 1 }, names),
      'AAPL',
    );
  });
});

describe('homeKeywordIsSymbolChip', () => {
  it('treats KR code labels as symbol chips', () => {
    assert.equal(homeKeywordIsSymbolChip({ label: '005930', kind: 'theme', weight: 1 }), true);
    assert.equal(homeKeywordIsSymbolChip({ label: 'HBM', kind: 'theme', weight: 1 }), false);
  });
});
