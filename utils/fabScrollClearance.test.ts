import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FAB_OVERLAY_SCROLL_CUSHION,
  fabOverlayScrollCushion,
  fabScrollClearanceAboveBase,
} from './fabScrollClearance.ts';

describe('fabOverlayScrollCushion', () => {
  it('returns 0 when there is no FAB', () => {
    assert.equal(fabOverlayScrollCushion(0), 0);
  });

  it('adds only a small cushion when FAB is present (not full FAB height)', () => {
    assert.equal(fabOverlayScrollCushion(1), FAB_OVERLAY_SCROLL_CUSHION);
    assert.equal(fabOverlayScrollCushion(2), FAB_OVERLAY_SCROLL_CUSHION);
    assert.equal(FAB_OVERLAY_SCROLL_CUSHION, 8);
  });
});

describe('fabScrollClearanceAboveBase (compat)', () => {
  it('delegates to overlay cushion', () => {
    assert.equal(fabScrollClearanceAboveBase(0, 12), 0);
    assert.equal(fabScrollClearanceAboveBase(1, 12), FAB_OVERLAY_SCROLL_CUSHION);
  });
});
