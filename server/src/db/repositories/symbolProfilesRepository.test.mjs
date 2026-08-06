import test from 'node:test';
import assert from 'node:assert/strict';
import { rowToProfile } from './symbolProfilesRepository.mjs';

test('rowToProfile maps postgres row fields', () => {
  const row = rowToProfile({
    symbol_key: 'global:AAPL',
    market: 'global',
    symbol: 'AAPL',
    display_symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    logo_url: 'https://assets.parqet.com/logos/symbol/AAPL',
    payload: { source: 'admin' },
    updated_at: new Date('2026-08-01T12:00:00.000Z'),
  });
  assert.equal(row.symbolKey, 'global:AAPL');
  assert.equal(row.logoUrl, 'https://assets.parqet.com/logos/symbol/AAPL');
  assert.equal(row.updatedAt, '2026-08-01T12:00:00.000Z');
  assert.deepEqual(row.payload, { source: 'admin' });
});

test('rowToProfile tolerates invalid updated_at and non-json payload', () => {
  const row = rowToProfile({
    symbol_key: 'kr:005930',
    market: 'kr',
    symbol: '005930',
    display_symbol: '005930',
    name: '삼성전자',
    exchange: null,
    logo_url: null,
    payload: { source: 'admin', bad: BigInt(1) },
    updated_at: new Date('not-a-date'),
  });
  assert.equal(row.symbolKey, 'kr:005930');
  assert.equal(row.updatedAt, null);
  assert.equal(row.payload, null);
});
