/**
 * Window math for WebWheelFlatList spacer virtualization.
 * Unmeasured rows must not under-estimate height — a short bottom spacer
 * leaves real rows unmounted while the user is already at max scroll.
 */

export type WebFlatListWindow = {
  startRow: number;
  endRow: number;
  topSpacer: number;
  bottomSpacer: number;
};

export type WebFlatListWindowInput = {
  rowCount: number;
  scrollTop: number;
  viewportHeight: number;
  /** Used for overscan px and cold-start sizing; also a floor for fallback height. */
  estimatedItemHeight: number;
  overscan: number;
  /** Row count to mount before viewport metrics exist. */
  initialWindowRows: number;
  getRowHeight: (rowIndex: number) => number;
};

/** Prefer a slight overestimate so bottom spacers are not shorter than reality. */
export function webFlatListFallbackRowHeight(
  measuredHeights: Iterable<number>,
  estimatedItemHeight: number,
): number {
  let count = 0;
  let sum = 0;
  for (const height of measuredHeights) {
    if (!(height > 0)) continue;
    count += 1;
    sum += height;
  }
  if (count === 0) return estimatedItemHeight;
  const avg = sum / count;
  return Math.max(estimatedItemHeight, Math.ceil(avg * 1.1));
}

export function computeWebFlatListWindow(input: WebFlatListWindowInput): WebFlatListWindow {
  const {
    rowCount,
    scrollTop,
    viewportHeight,
    estimatedItemHeight,
    overscan,
    initialWindowRows,
    getRowHeight,
  } = input;

  if (rowCount <= 0) {
    return { startRow: 0, endRow: -1, topSpacer: 0, bottomSpacer: 0 };
  }

  if (viewportHeight <= 0) {
    const coldEnd = Math.min(rowCount - 1, Math.max(0, initialWindowRows - 1));
    let coldBottom = 0;
    for (let row = coldEnd + 1; row < rowCount; row++) coldBottom += getRowHeight(row);
    return { startRow: 0, endRow: coldEnd, topSpacer: 0, bottomSpacer: coldBottom };
  }

  let totalHeight = 0;
  for (let row = 0; row < rowCount; row++) totalHeight += getRowHeight(row);

  const overscanPx = overscan * estimatedItemHeight;
  const viewTop = Math.max(0, scrollTop - overscanPx);
  const viewBottom = scrollTop + Math.max(viewportHeight, estimatedItemHeight) + overscanPx;
  const distanceToContentEnd = totalHeight - (scrollTop + viewportHeight);
  const nearEnd =
    distanceToContentEnd <= Math.max(viewportHeight * 1.5, overscanPx * 2);

  let acc = 0;
  let start = 0;
  for (let row = 0; row < rowCount; row++) {
    const h = getRowHeight(row);
    if (acc + h > viewTop) {
      start = row;
      break;
    }
    acc += h;
    if (row === rowCount - 1) start = row;
  }

  let end = start;
  if (nearEnd) {
    end = rowCount - 1;
  } else {
    let scan = acc;
    for (let row = start; row < rowCount; row++) {
      scan += getRowHeight(row);
      end = row;
      if (scan >= viewBottom) break;
    }
    if (rowCount - 1 - end <= overscan) {
      end = rowCount - 1;
    }
  }

  let top = 0;
  for (let row = 0; row < start; row++) top += getRowHeight(row);
  let bottom = 0;
  for (let row = end + 1; row < rowCount; row++) bottom += getRowHeight(row);

  return { startRow: start, endRow: end, topSpacer: top, bottomSpacer: bottom };
}
