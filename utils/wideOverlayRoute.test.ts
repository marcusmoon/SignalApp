/**
 * Wide overlay 경로 매칭 — etf-insights가 etf-insight보다 먼저.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  legacyPathnameToOverlayKind,
  normalizePathname,
  symbolTickerFromPathname,
} from './wideOverlayRoute.ts';

describe('legacyPathnameToOverlayKind', () => {
  it('maps /etf-insights before /etf-insight prefix (regression: plural matched singular)', () => {
    assert.equal(legacyPathnameToOverlayKind('/etf-insights'), 'etf-insights');
    assert.equal(legacyPathnameToOverlayKind('/etf-insights/2024-06-01'), 'etf-insights');
    assert.equal(legacyPathnameToOverlayKind('/etf-insight'), 'etf-insight');
    assert.equal(legacyPathnameToOverlayKind('/etf-insight/abc'), 'etf-insight');
  });

  it('maps other legacy drill paths', () => {
    assert.equal(legacyPathnameToOverlayKind('/news-digest/x'), 'news-digest');
    assert.equal(legacyPathnameToOverlayKind('/today-briefing'), 'today-briefing');
    assert.equal(legacyPathnameToOverlayKind('/unknown'), null);
  });
});

describe('normalizePathname / symbolTickerFromPathname', () => {
  it('strips query/trailing slash and extracts ticker', () => {
    assert.equal(normalizePathname('/symbol/aapl/?x=1'), '/symbol/aapl');
    assert.equal(symbolTickerFromPathname('/symbol/aapl'), 'AAPL');
  });
});
