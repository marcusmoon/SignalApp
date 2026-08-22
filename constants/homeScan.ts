import {
  FEED_ARTICLE_TITLE_LINE_PX,
  FEED_ARTICLE_TITLE_PX,
  FEED_DETAIL_TITLE_PX,
} from '@/constants/feedTypography';

/**
 * Home-only **base** type scale at settings 「기본」(multiplier 1).
 * Always apply through `ft.ff` / `scaleFont` so 글꼴 크기 (크게 1.06 ·
 * 매우 크게 1.12) and 피드 항목 굵기 (볼드 +1px) still compose.
 * Do not reuse these on news/disclosure/YouTube lists.
 */

export const HOME_HERO_HEADLINE_PX = FEED_DETAIL_TITLE_PX;
export const HOME_HERO_HEADLINE_LINE_PX = 24;

export const HOME_AGENDA_TITLE_PX = 16;
export const HOME_AGENDA_TITLE_LINE_PX = 22;
export const HOME_AGENDA_TIME_PX = 13;
export const HOME_AGENDA_TIME_LINE_PX = 18;
export const HOME_AGENDA_CHIP_PX = 11;

export const HOME_NEWS_TITLE_PX = FEED_ARTICLE_TITLE_PX;
export const HOME_NEWS_TITLE_LINE_PX = FEED_ARTICLE_TITLE_LINE_PX;
export const HOME_NEWS_ROW_PAD_V = 10;
export const HOME_NEWS_META_PX = 11;

export const HOME_KEYWORD_CHIP_PX = 12;
export const HOME_KEYWORD_CHIP_LINE_PX = 16;
export const HOME_KEYWORD_CHIP_LOGO = 20;
export const HOME_KEYWORD_CHIP_MAX_WIDTH = 168;

export const HOME_QUOTE_NAME_PX = 14;
export const HOME_QUOTE_PRICE_PX = 15;
export const HOME_QUOTE_CHANGE_PX = 16;
export const HOME_QUOTE_LOGO = 24;
export const HOME_QUOTE_TILE_MIN_HEIGHT = 60;

export const HOME_SHORTCUT_LABEL_PX = 12;
export const HOME_SHORTCUT_ICON = 18;

export const HOME_CARD_PAD_H = 14;
export const HOME_ETF_TITLE_PX = 16;
export const HOME_ETF_TITLE_LINE_PX = 22;
