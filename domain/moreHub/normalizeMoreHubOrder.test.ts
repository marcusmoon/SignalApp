/**
 * More 허브 순서 — ETF·스크리너·게임센터 삽입 · 레거시 키.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED,
  normalizeMoreHubOrderRaw,
} from './normalizeMoreHubOrder.ts';

describe('normalizeMoreHubOrderRaw', () => {
  it('returns defaults for non-array / unrecognized saves', () => {
    assert.deepEqual(normalizeMoreHubOrderRaw(null), MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED);
    assert.deepEqual(normalizeMoreHubOrderRaw(['board']), MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED);
  });

  it('migrates todayBriefing → disclosures and drops settings', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw(['account', 'todayBriefing', 'board', 'settings']),
      ['account', 'disclosures', 'etfBriefing', 'screener', 'board', 'gameCenter'],
    );
  });

  it('inserts etfBriefing+screener before board and gameCenter after board when missing', () => {
    assert.deepEqual(normalizeMoreHubOrderRaw(['account', 'disclosures', 'board']), [
      'account',
      'disclosures',
      'etfBriefing',
      'screener',
      'board',
      'gameCenter',
    ]);
  });

  it('inserts screener after etfBriefing when only screener missing', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw(['account', 'disclosures', 'etfBriefing', 'board']),
      ['account', 'disclosures', 'etfBriefing', 'screener', 'board', 'gameCenter'],
    );
  });

  it('moves legacy gameCenter-before-board to after board', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw([
        'account',
        'disclosures',
        'etfBriefing',
        'screener',
        'gameCenter',
        'board',
      ]),
      ['account', 'disclosures', 'etfBriefing', 'screener', 'board', 'gameCenter'],
    );
  });

  it('places gameCenter right after board even if custom order had it earlier', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw(['account', 'gameCenter', 'board', 'etfBriefing', 'disclosures']),
      ['account', 'board', 'gameCenter', 'etfBriefing', 'screener', 'disclosures'],
    );
  });
});
