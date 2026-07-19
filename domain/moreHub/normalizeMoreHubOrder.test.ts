/**
 * More 허브 순서 — ETF·게임센터 삽입 · 레거시 키.
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
      ['account', 'disclosures', 'etfBriefing', 'gameCenter', 'board'],
    );
  });

  it('inserts etfBriefing and gameCenter before board when missing', () => {
    assert.deepEqual(normalizeMoreHubOrderRaw(['account', 'disclosures', 'board']), [
      'account',
      'disclosures',
      'etfBriefing',
      'gameCenter',
      'board',
    ]);
  });

  it('inserts gameCenter before board when only gameCenter missing', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw(['account', 'disclosures', 'etfBriefing', 'board']),
      ['account', 'disclosures', 'etfBriefing', 'gameCenter', 'board'],
    );
  });

  it('preserves custom order when gameCenter already present', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw(['account', 'gameCenter', 'board', 'etfBriefing', 'disclosures']),
      ['account', 'gameCenter', 'board', 'etfBriefing', 'disclosures'],
    );
  });
});
