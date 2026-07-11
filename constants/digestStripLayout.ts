import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

export const DIGEST_CARD_GAP = 10;
/** wide 스트립 가로 inset (compact는 topFixed padding과 맞춤) */
export const DIGEST_CARD_EDGE_PAD = 12;
/** iPhone 1열: 다음 카드가 보이는 peek 폭 */
export const DIGEST_SINGLE_NEXT_CARD_PEEK = 36;
/** wide: 다음 카드가 살짝 보이도록 */
export const DIGEST_PAIR_CARD_WIDTH_RATIO = 0.48;
/** 스트립 끝 refresh 타일 너비 */
export const DIGEST_REFRESH_TAIL_WIDTH = 52;
/** 다이제스트 카드 공통 높이 (뉴스·공시 동일, 타이포 기본값 기준) */
export const DIGEST_STRIP_CARD_MIN_HEIGHT = 124;
export const DIGEST_STRIP_CARD_MIN_HEIGHT_PAIR = 112;
export const DIGEST_STRIP_BADGE_ROW_HEIGHT = 20;
export const DIGEST_STRIP_BADGE_ROW_HEIGHT_PAIR = 18;
export const DIGEST_STRIP_FOOTER_MIN_HEIGHT = 28;
/** 공시 다이제스트 카드 태그(칩) 최대 개수 */
export const DISCLOSURE_DIGEST_TAG_MAX_SINGLE = 3;
export const DISCLOSURE_DIGEST_TAG_MAX_PAIR = 1;

/** 피드 타이포·볼드 설정에 맞춘 다이제스트 카드 최소 높이 */
export function digestStripCardMinHeight(
  pairLayout: boolean,
  ft: FeedContentTypography,
): number {
  const titleLine = pairLayout ? ft.ff(19) : ft.ff(21);
  const padV = pairLayout ? ft.pad(8) : ft.pad(9);
  const badgeH = pairLayout ? DIGEST_STRIP_BADGE_ROW_HEIGHT_PAIR : DIGEST_STRIP_BADGE_ROW_HEIGHT;
  const gap = pairLayout ? 4 : 5;
  return Math.ceil(padV * 2 + badgeH + gap * 2 + titleLine * 2 + DIGEST_STRIP_FOOTER_MIN_HEIGHT);
}

export function digestStripCardWidth(
  containerWidth: number,
  pairLayout: boolean,
  itemCount: number,
): number {
  if (containerWidth <= 0) return 0;
  if (pairLayout) {
    return Math.floor((containerWidth - DIGEST_CARD_GAP) * DIGEST_PAIR_CARD_WIDTH_RATIO);
  }
  if (itemCount <= 1) return containerWidth;
  return Math.max(0, containerWidth - DIGEST_SINGLE_NEXT_CARD_PEEK);
}

export function digestStripScrollPadding(
  pairLayout: boolean,
  itemCount: number,
): { paddingHorizontal: number; paddingRight: number } {
  const showSinglePeek = !pairLayout && itemCount > 1;
  return {
    paddingHorizontal: pairLayout ? DIGEST_CARD_EDGE_PAD : 0,
    paddingRight: pairLayout ? DIGEST_CARD_EDGE_PAD + 4 : showSinglePeek ? DIGEST_SINGLE_NEXT_CARD_PEEK : 0,
  };
}
