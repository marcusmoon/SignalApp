import { StyleSheet } from 'react-native';

import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import { COMFORT_GAP_SM } from '@/constants/comfortDensity';
import {
  FEED_ARTICLE_TITLE_PX,
  FEED_BADGE_PX,
  FEED_CHIP_PX,
  FEED_DIGEST_TITLE_PX,
  FEED_META_TIME_PX,
} from '@/constants/feedTypography';
import {
  UI_RADIUS_DIGEST_PAIR,
  UI_RADIUS_DIGEST_SINGLE,
} from '@/constants/uiCornerRadius';
import {
  DIGEST_STRIP_BADGE_ROW_HEIGHT,
  DIGEST_STRIP_BADGE_ROW_HEIGHT_PAIR,
  DIGEST_STRIP_FOOTER_MIN_HEIGHT,
  digestStripCardMinHeight,
} from '@/constants/digestStripLayout';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type DigestStripCardStyleOptions = {
  pairLayout: boolean;
  accentColor: string;
};

export function makeDigestStripCardStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  { pairLayout, accentColor }: DigestStripCardStyleOptions,
) {
  const titleSize = pairLayout ? ft.ff(FEED_DIGEST_TITLE_PX) : ft.ff(FEED_ARTICLE_TITLE_PX);
  const titleLine = pairLayout ? sf(19) : sf(21);
  const badgeHeight = pairLayout ? DIGEST_STRIP_BADGE_ROW_HEIGHT_PAIR : DIGEST_STRIP_BADGE_ROW_HEIGHT;
  const cardMinHeight = digestStripCardMinHeight(pairLayout, ft);
  const sectionGap = pairLayout ? 6 : 7;

  return StyleSheet.create({
    card: {
      flex: 1,
      minHeight: cardMinHeight,
      paddingLeft: pairLayout ? 14 : 18,
      paddingRight: pairLayout ? ft.pad(11) : ft.pad(13),
      paddingVertical: pairLayout ? ft.pad(10) : ft.pad(11),
      borderRadius: pairLayout ? UI_RADIUS_DIGEST_PAIR : UI_RADIUS_DIGEST_SINGLE,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      gap: sectionGap,
      overflow: 'hidden',
      ...(pairLayout
        ? {}
        : {
            shadowColor: '#000000',
            shadowOpacity: 0.04,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 5 },
            elevation: 1,
          }),
    },
    accentLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: CONTENT_ACCENT_LINE_WIDTH,
      backgroundColor: accentColor,
      opacity: pairLayout ? 0.45 : 1,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
      gap: 6,
      height: badgeHeight,
      flexShrink: 0,
      overflow: 'hidden',
    },
    topicChip: {
      flexShrink: 1,
      overflow: 'hidden',
      paddingHorizontal: pairLayout ? 6 : 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: ft.ff(FEED_CHIP_PX),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
    },
    titleBody: {
      flexShrink: 0,
      minHeight: titleLine * 2,
    },
    title: {
      fontSize: titleSize,
      lineHeight: titleLine,
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: COMFORT_GAP_SM,
      minHeight: DIGEST_STRIP_FOOTER_MIN_HEIGHT,
      flexShrink: 0,
    },
    footerLead: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    footer: {
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      flex: 1,
      minWidth: 0,
    },
    detailBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      flexShrink: 0,
    },
    detailBtnPressed: {
      opacity: 0.88,
    },
  });
}
