import { Platform, StyleSheet } from 'react-native';

import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { FEED_BADGE_PX } from '@/constants/feedTypography';
import { webFlexFill, webScrollViewportStyle } from '@/constants/webLayout';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import {
  getSegmentTabBarStyles,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';

export function makeQuotesStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  changeColors: { up: string; down: string },
) {
  const segmentTab = getSegmentTabBarStyles(theme, sf);
  const fixedHeader = getScreenFixedHeaderStyles(theme);
  return StyleSheet.create({
    safe: { ...webFlexFill, backgroundColor: theme.bg },
    mainColumn: {
      ...webFlexFill,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    mainColumnWide: {
      ...wideContentFill,
    },
    detailPanePad: {
      flex: 1,
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP,
    },
    topFixed: fixedHeader.strip,
    list: { ...webScrollViewportStyle },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    listContentWide: { paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP },
    /** As-of already sits in topFixed on wide — don't double the top pad. */
    listContentBelowAsOf: { paddingTop: 8 },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnCompact: segmentTab.segBtnCompact,
    segmentDivider: segmentTab.segmentDivider,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    /** Below segment bar — home quotes as-of chip tone */
    asOfRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
    },
    asOfRowWide: {
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP > 8 ? 4 : 6,
    },
    asOfChip: {
      flexShrink: 0,
      maxWidth: '56%',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    asOfChipText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      textAlign: 'right',
    },
    errBox: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
    },
    errText: { fontSize: sf(12), color: theme.danger, lineHeight: sf(18) },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    empty: { fontSize: sf(13), color: theme.textMuted, marginTop: 8 },
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      paddingHorizontal: ft.pad(16),
      paddingVertical: ft.pad(12),
    },
    swipeRowGrouped: {
      marginBottom: 0,
      borderRadius: 0,
      overflow: 'hidden',
    },
    swipeRight: {
      width: 80,
      height: '100%',
    },
    swipeDeleteBtn: {
      flex: 1,
      backgroundColor: theme.danger,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    swipeDeleteText: {
      color: '#FFFFFF',
      fontSize: sf(15),
      fontWeight: '600',
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 6,
    },
    priceCol: {
      flexShrink: 1,
      alignItems: 'flex-end',
      minWidth: 104,
      maxWidth: '48%',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 16,
    },
    symCol: { flex: 1, minWidth: 0, flexShrink: 1 },
    symBlock: { alignSelf: 'flex-start', maxWidth: '100%' },
    symRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      gap: 8,
    },
    symPressable: { flexShrink: 0, minWidth: 0 },
    sym: {
      fontSize: ft.ff(16),
      lineHeight: ft.ff(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
      letterSpacing: 0.5,
    },
    symPrev: {
      fontSize: ft.ff(12),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      marginTop: 4,
      lineHeight: ft.ff(17),
    },
    symSub: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      marginTop: 4,
    },
    price: {
      maxWidth: '100%',
      fontSize: ft.ff(18),
      lineHeight: ft.ff(22),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    na: { fontSize: sf(16), color: theme.textDim },
    naMuted: {
      fontSize: sf(13),
      lineHeight: sf(17),
      fontWeight: '600',
      color: theme.textMuted,
    },
    removeBtn: { padding: 2 },
    chg: {
      maxWidth: '100%',
      fontSize: ft.ff(13),
      lineHeight: ft.ff(17),
      fontWeight: ft.emphasisWeight,
      marginTop: 4,
      textAlign: 'right',
    },
    chgUp: { color: changeColors.up },
    chgDn: { color: changeColors.down },
    fail: { fontSize: sf(12), color: theme.danger },
    pendingHint: { fontSize: sf(12), color: theme.textMuted, marginTop: 2 },
    yahooInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
      marginLeft: 8,
      paddingVertical: 2,
    },
    yahooInlinePressed: { opacity: 0.75 },
    yahooInlineText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
  });
}
