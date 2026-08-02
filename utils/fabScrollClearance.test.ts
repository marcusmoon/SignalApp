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

  it('does not reserve FAB height (cushion stays 0)', () => {
    assert.equal(fabOverlayScrollCushion(1), FAB_OVERLAY_SCROLL_CUSHION);
    assert.equal(fabOverlayScrollCushion(2), FAB_OVERLAY_SCROLL_CUSHION);
    assert.equal(FAB_OVERLAY_SCROLL_CUSHION, 0);
  });
});

describe('fabScrollClearanceAboveBase (compat)', () => {
  it('delegates to overlay cushion', () => {
    assert.equal(fabScrollClearanceAboveBase(0, 4), 0);
    assert.equal(fabScrollClearanceAboveBase(1, 4), FAB_OVERLAY_SCROLL_CUSHION);
  });
});
