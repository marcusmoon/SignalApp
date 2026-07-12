import {
  APP_CONTENT_MAX_WIDTH,
  MASTER_PANEL_MIN_WIDTH,
  MASTER_PANEL_WIDTH_RATIO,
  SIDEBAR_WIDTH,
} from '@/constants/responsiveLayout';

const DEFAULT_GAP = 6;
const DEFAULT_MIN_CELL_WIDTH = 52;

export type ExternalLinkGridColumnOptions = {
  gap?: number;
  minCellWidth?: number;
  /** 화면·폭에 맞춰 허용하는 최대 열 수 */
  maxColumns?: number;
  /** 항목이 충분할 때 우선할 열 수 (예: 3) */
  preferredColumns?: number;
};

export type ExternalLinkContentWidthInput = {
  windowWidth: number;
  isWideLayout: boolean;
  useTwoPane: boolean;
  /** 그리드 박스 바깥 좌우 패딩 합의 절반(스크롤·카드 등) — 첫 레이아웃 추정용 */
  horizontalInset?: number;
  boxPaddingHorizontal?: number;
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

/** iPad 사이드바·2-패널·콘텐츠 max-width를 반영한 그리드 추정 폭 */
export function estimateExternalLinkContentWidth(input: ExternalLinkContentWidthInput): number {
  let paneWidth = input.windowWidth;

  if (input.isWideLayout) {
    paneWidth = Math.max(0, paneWidth - SIDEBAR_WIDTH);
  }

  if (input.useTwoPane) {
    const masterWidth = Math.max(
      MASTER_PANEL_MIN_WIDTH,
      Math.round(paneWidth * MASTER_PANEL_WIDTH_RATIO),
    );
    paneWidth = Math.max(0, paneWidth - masterWidth);
  } else {
    paneWidth = Math.min(paneWidth, APP_CONTENT_MAX_WIDTH);
  }

  const outerInset = (input.horizontalInset ?? 0) * 2;
  const boxInset = (input.boxPaddingHorizontal ?? 0) * 2;
  return Math.max(0, paneWidth - outerInset - boxInset);
}

/** onLayout 측정값 우선 — 추정 폭이 실제보다 크면 열 수가 줄어 2열로 보이는 문제 방지 */
export function resolveExternalLinkGridInnerWidth(
  measuredOuterWidth: number,
  boxPaddingHorizontal: number,
  estimatedInnerWidth: number,
): number {
  if (measuredOuterWidth > 0) {
    return Math.max(0, measuredOuterWidth - boxPaddingHorizontal * 2);
  }
  return Math.max(estimatedInnerWidth, 180);
}
