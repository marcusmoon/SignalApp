const DEFAULT_GAP = 6;
const DEFAULT_MIN_CELL_WIDTH = 56;

export type ExternalLinkGridColumnOptions = {
  gap?: number;
  minCellWidth?: number;
  /** 화면·폭에 맞춰 허용하는 최대 열 수 */
  maxColumns?: number;
  /** 항목이 충분할 때 우선할 열 수 (예: 3) */
  preferredColumns?: number;
};

/**
 * 파비콘 숏컷 그리드 열 수 — 가용 폭·항목 수·선호 열 수를 반영한다.
 * 종목 상세·더보기 숏링크 공통.
 */
export function computeExternalLinkGridColumns(
  innerWidth: number,
  itemCount: number,
  options: ExternalLinkGridColumnOptions = {},
): number {
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

export function externalLinkGridCellWidth(
  innerWidth: number,
  columns: number,
  gap = DEFAULT_GAP,
): number {
  if (innerWidth <= 0 || columns <= 0) return 0;
  return (innerWidth - gap * (columns - 1)) / columns;
}
