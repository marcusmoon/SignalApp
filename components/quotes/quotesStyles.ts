import { Platform, StyleSheet } from 'react-native';

import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { FEED_BADGE_PX } from '@/constants/feedTypography';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
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
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnCompact: segmentTab.segBtnCompact,
    segmentDivider: segmentTab.segmentDivider,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    /** Between segment chrome and list — delayed as-of chip (end-aligned like home meta) */
    asOfBand: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    asOfBandWide: {
      paddingTop: Math.max(8, SCREEN_WIDE_CONTENT_PADDING_TOP - 8),
    },
    asOfChip: {
      flexShrink: 1,
      maxWidth: '88%',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    asOfChipText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
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
    /** ETF 그룹 — 홈 시세 레이어 룰과 동일 (라벨 + 구분선) */
    etfGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    etfGroupHeaderFirst: {
      paddingTop: 4,
    },
    etfGroupHeaderLabel: {
      flexShrink: 0,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: UI_FONT_WEIGHT_EMPHASIS,
      color: theme.textMuted,
    },
    etfGroupHeaderLine: {
      flex: 1,
      minWidth: 16,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    watchRowActive: {
      opacity: 0.92,
    },
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
      flexShrink: 0,
      alignItems: 'flex-end',
      minWidth: 104,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 16,
    },
    symCol: { flex: 1, minWidth: 0, flexShrink: 1 },
    symBlock: { alignSelf: 'stretch', maxWidth: '100%' },
    symRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      gap: 8,
      minWidth: 0,
    },
    symPressable: {
      flex: 1,
      minWidth: 72,
      flexShrink: 1,
      alignSelf: 'stretch',
      justifyContent: 'center',
      paddingVertical: 4,
    },
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
      flexShrink: 0,
      marginLeft: 4,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    yahooInlineText: {
      flexShrink: 0,
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
  });
}
