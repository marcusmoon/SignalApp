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
assert(ipadDetailMeasured === 302, 'Measured width subtracts box padding');

console.log('OK: external link grid columns');
