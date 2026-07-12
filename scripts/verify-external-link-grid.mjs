/**
 * externalLinkGrid 열 수 스모크 테스트.
 * 실행: node scripts/verify-external-link-grid.mjs
 */

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

const DEFAULT_GAP = 6;
const DEFAULT_MIN_CELL_WIDTH = 52;

function computeExternalLinkGridColumns(innerWidth, itemCount, options = {}) {
  const gap = options.gap ?? DEFAULT_GAP;
  const minCellWidth = options.minCellWidth ?? DEFAULT_MIN_CELL_WIDTH;
  const maxColumns = Math.max(1, options.maxColumns ?? 3);
  const preferredColumns = Math.max(1, options.preferredColumns ?? 3);

  if (innerWidth <= 0 || itemCount <= 0) return 1;

  const maxByWidth = Math.max(1, Math.floor((innerWidth + gap) / (minCellWidth + gap)));
  const cap = Math.min(maxColumns, maxByWidth, itemCount);

  const minWidthForPreferred = preferredColumns * 40 + (preferredColumns - 1) * gap;
  if (itemCount >= preferredColumns && innerWidth >= minWidthForPreferred) {
    return Math.min(preferredColumns, itemCount, maxColumns);
  }

  if (itemCount >= preferredColumns && cap >= preferredColumns) {
    return preferredColumns;
  }

  return cap;
}

function resolveExternalLinkGridInnerWidth(measuredOuterWidth, boxPaddingHorizontal, estimatedInnerWidth) {
  if (measuredOuterWidth > 0) {
    return Math.max(0, measuredOuterWidth - boxPaddingHorizontal * 2);
  }
  return Math.max(estimatedInnerWidth, 180);
}

assert(
  computeExternalLinkGridColumns(320, 6, { preferredColumns: 3 }) === 3,
  'iPhone-width grid prefers 3 columns',
);
assert(
  computeExternalLinkGridColumns(280, 6, { preferredColumns: 3 }) === 3,
  'Narrow detail pane still fits 3 columns',
);

const ipadDetailMeasured = resolveExternalLinkGridInnerWidth(310, 4, 620);
assert(
  computeExternalLinkGridColumns(ipadDetailMeasured, 6, { preferredColumns: 3 }) === 3,
  'iPad detail uses measured width for 3 columns (not inflated estimate)',
);
assert(
  computeExternalLinkGridColumns(180, 6, { preferredColumns: 3 }) === 3,
  'Flex row layout keeps 3 columns on narrow iPad detail pane',
);

function chunkExternalLinkGridItems(items, columns) {
  const safeColumns = Math.max(1, columns);
  const rows = [];
  for (let index = 0; index < items.length; index += safeColumns) {
    rows.push(items.slice(index, index + safeColumns));
  }
  return rows;
}

assert(chunkExternalLinkGridItems([1, 2, 3, 4, 5, 6, 7], 3).length === 3, 'Chunk into 3-column rows');
assert(chunkExternalLinkGridItems([1, 2, 3, 4, 5, 6, 7], 3)[0].length === 3, 'First row has 3 items');

console.log('OK: external link grid columns');
