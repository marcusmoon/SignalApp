/**
 * More 허브 순서 — ETF를 게시판 앞에 삽입 · 레거시 키.
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
      ['account', 'disclosures', 'etfBriefing', 'board'],
    );
  });

  it('inserts etfBriefing before board when missing (regression: ETF after board)', () => {
    assert.deepEqual(normalizeMoreHubOrderRaw(['account', 'disclosures', 'board']), [
      'account',
      'disclosures',
      'etfBriefing',
      'board',
    ]);
  });

  it('preserves custom order when etfBriefing already present', () => {
    assert.deepEqual(
      normalizeMoreHubOrderRaw(['account', 'board', 'etfBriefing', 'disclosures']),
      ['account', 'board', 'etfBriefing', 'disclosures'],
    );
  });
});
