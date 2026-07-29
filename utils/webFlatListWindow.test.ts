import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeWebFlatListWindow,
  webFlatListFallbackRowHeight,
} from './webFlatListWindow.ts';

describe('webFlatListFallbackRowHeight', () => {
  it('returns estimate when nothing measured', () => {
    assert.equal(webFlatListFallbackRowHeight([], 96), 96);
  });

  it('overestimates from measured average', () => {
    assert.equal(webFlatListFallbackRowHeight([200, 220, 180], 96), Math.ceil(200 * 1.1));
  });
});

describe('computeWebFlatListWindow', () => {
  it('mounts remaining rows when scrolled to the underestimated end', () => {
    const rowCount = 40;
    // First 12 rows measured tall; rest still use a short fallback — classic clip case.
    const heights = Array.from({ length: rowCount }, (_, i) => (i < 12 ? 200 : 96));
    const getRowHeight = (row: number) => heights[row] ?? 96;
    let total = 0;
    for (const h of heights) total += h;

    const viewportHeight = 800;
    const scrollTop = Math.max(0, total - viewportHeight);

    const win = computeWebFlatListWindow({
      rowCount,
      scrollTop,
      viewportHeight,
      estimatedItemHeight: 96,
      overscan: 6,
      initialWindowRows: 12,
      getRowHeight,
    });

    assert.equal(win.endRow, rowCount - 1);
    assert.equal(win.bottomSpacer, 0);
  });

  it('keeps a bottom spacer while scrolled near the top of a long list', () => {
    const rowCount = 80;
    const getRowHeight = () => 120;
    const win = computeWebFlatListWindow({
      rowCount,
      scrollTop: 0,
      viewportHeight: 800,
      estimatedItemHeight: 120,
      overscan: 6,
      initialWindowRows: 12,
      getRowHeight,
    });

    assert.ok(win.endRow < rowCount - 1);
    assert.ok(win.bottomSpacer > 0);
  });

  it('cold-starts with a bounded window', () => {
    const win = computeWebFlatListWindow({
      rowCount: 50,
      scrollTop: 0,
      viewportHeight: 0,
      estimatedItemHeight: 100,
      overscan: 6,
      initialWindowRows: 12,
      getRowHeight: () => 100,
    });
    assert.equal(win.startRow, 0);
    assert.equal(win.endRow, 11);
    assert.equal(win.bottomSpacer, 38 * 100);
  });
});
