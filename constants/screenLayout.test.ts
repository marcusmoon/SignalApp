import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fabScrollClearanceAboveBase } from './screenLayout.ts';

describe('fabScrollClearanceAboveBase', () => {
  it('returns 0 when there is no FAB', () => {
    assert.equal(fabScrollClearanceAboveBase(0, 12), 0);
  });

  it('only adds overhang above the scroll base (not full FAB+GAP)', () => {
    // offset 8 + 56 = 64; base 12 → clearance 52 (not 68)
    assert.equal(
      fabScrollClearanceAboveBase(1, 12, { fabSize: 56, fabGap: 12, offset: 8 }),
      52,
    );
    // offset 8 + 56 + 12 + 56 = 132; base 12 → 120 (not 136)
    assert.equal(
      fabScrollClearanceAboveBase(2, 12, { fabSize: 56, fabGap: 12, offset: 8 }),
      120,
    );
  });
});
