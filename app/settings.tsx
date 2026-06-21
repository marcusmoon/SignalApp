import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useLocalSearchParams, useRouter } from 'expo-router';
import developerAvatar from '@/assets/images/developer-avatar.png';
import { IpadSidebarScreen } from '@/components/layout/IpadSidebarScreen';
import { DEVELOPER_LINKEDIN_URL } from '@/constants/developer';
import { NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  tabBarBottomInset,
  tabBarHorizontalMargin,
  tabBarPositionBottom,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatMessage, type AppLocale, type MessageId } from '@/locales/messages';
import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  loadQuotesSegmentOrder,
  saveQuotesSegmentOrder,
  type QuoteSegmentKey,
} from '@/services/quotesSegmentOrderPreference';
import {
  getQuoteChangeColors,
  QUOTES_CHANGE_COLOR_CONVENTION_ORDER,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import {
  loadQuotesChangeColorConvention,
  saveQuotesChangeColorConvention,
} from '@/services/quotesChangeColorPreference';
import type { AccentPresetId } from '@/services/accentPreference';
import { ACCENT_PRESETS, normalizeHex } from '@/services/accentPreference';
import type { FeedContentWeightId } from '@/services/feedContentWeightPreference';
import type { FontSizePresetId } from '@/services/fontSizePreference';
import type { ThemeAppearanceMode } from '@/services/themeAppearancePreference';
import { clearCalendarCache } from '@/services/cache/calendarCache';
import { clearNewsCache } from '@/services/cache/newsCache';
import { clearQuotesCache } from '@/services/cache/quotesCache';
import { clearYoutubeCache } from '@/services/cache/youtubeCache';
import { clearSignalApiCache } from '@/integrations/signal-api/cache';
import {
  loadQuotesListLimits,
  normalizeQuotesListLimits,
  quotesListCountChoicesForField,
  saveQuotesListLimits,
  QUOTES_LIST_LIMIT_BOUNDS,
  QUOTES_LIST_LIMITS_DEFAULTS,
  type QuotesListLimits,
} from '@/services/quotesListLimitsPreference';
import {
  DEFAULT_NEWS_HASHTAG_DISPLAY_MAX,
  loadNewsHashtagDisplayMax,
  MAX_NEWS_HASHTAG_DISPLAY_MAX,
  MIN_NEWS_HASHTAG_DISPLAY_MAX,
  saveNewsHashtagDisplayMax,
} from '@/services/newsHashtagDisplayPreference';
import { loadNewsSegmentOrder, saveNewsSegmentOrder } from '@/services/newsSegmentOrderPreference';
import { syncCalendarLocalReminders } from '@/services/calendarLocalReminders';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/services/notificationPreferences';
import { registerPushDeviceIfPossible } from '@/services/pushDeviceRegistration';
import {
  loadNewsUnreadCheckIntervalMinutes,
  NEWS_UNREAD_CHECK_INTERVAL_OPTIONS,
  saveNewsUnreadCheckIntervalMinutes,
} from '@/services/newsUnreadCheckIntervalPreference';
import {
  loadMoreReferenceLinksVisible,
  saveMoreReferenceLinksVisible,
} from '@/services/moreReferenceLinksPreference';
import {
  APP_ICON_VARIANTS,
  loadAppIconVariant,
  saveAppIconVariant,
  type AppIconVariant,
} from '@/services/appIconPreference';
import {
  loadMainEntry,
  MAIN_ENTRY_DISPLAY_ORDER,
  saveMainEntry,
  type MainEntryKey,
} from '@/services/mainEntryPreference';
import {
  loadTabBarOpacityLevel,
  saveTabBarOpacityLevel,
  tabBarOpacityPercent,
  type TabBarOpacityLevel,
} from '@/services/tabBarOpacityPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  getEffectiveSignalApiBaseUrl,
  loadSignalServerPrefs,
  probeSignalServerBaseUrl,
  resolveSignalServerProbeTarget,
  saveSignalServerPrefs,
  SIGNAL_SERVER_MODES,
  type SignalServerMode,
} from '@/services/signalServerEndpoint';
import {
  ACCENT_PALETTE_COLS,
  ACCENT_PALETTE_ROWS,
  buildRainbowKoreanAccentPalette,
} from '@/utils/accentSwatchPalette';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BTN_PADDING_V,
  SEGMENT_TAB_BTN_RADIUS,
  SEGMENT_TAB_FONT_SIZE,
  SEGMENT_TAB_FONT_WEIGHT,
  SEGMENT_TAB_GAP,
  SEGMENT_TAB_LINE_HEIGHT,
  SEGMENT_TAB_OUTER_RADIUS,
  SEGMENT_TAB_PADDING,
} from '@/constants/segmentTabBar';

type SettingsTab =
  | 'display'
  | 'notifications'
  | 'news'
  | 'quotes'
  | 'server';

const SETTINGS_TABS: { key: SettingsTab; labelId: MessageId }[] = [
  { key: 'display', labelId: 'settingsTabDisplay' },
  { key: 'notifications', labelId: 'settingsTabNotifications' },
  { key: 'news', labelId: 'settingsTabNews' },
  { key: 'quotes', labelId: 'settingsTabQuotes' },
  { key: 'server', labelId: 'settingsTabServer' },
];

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

const QUOTES_CHANGE_COLOR_LABEL: Record<QuotesChangeColorConvention, MessageId> = {
  korea: 'settingsQuotesChangeColorKorea',
  us: 'settingsQuotesChangeColorUs',
};

const QUOTES_CHANGE_COLOR_DESC: Record<QuotesChangeColorConvention, MessageId> = {
  korea: 'settingsQuotesChangeColorKoreaDesc',
  us: 'settingsQuotesChangeColorUsDesc',
};

const NEWS_FEED_SEGMENT_LABEL: Record<NewsSegmentKey, MessageId> = {
  watch: 'feedSegmentWatch',
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
  video: 'feedSegmentVideo',
};

const SIGNAL_SERVER_LABEL: Record<SignalServerMode, MessageId> = {
  bundle: 'settingsSignalServerModeBundle',
  dev: 'settingsSignalServerModeDev',
  real: 'settingsSignalServerModeReal',
  custom: 'settingsSignalServerModeCustom',
};

/** 뉴스 세그먼트 순서 목록 높이 */
const NEWS_SEGMENT_ORDER_ROW_GAP = 8;
const NEWS_SEGMENT_ORDER_LIST_HEIGHT =
  54 * NEWS_SEGMENT_ORDER.length + NEWS_SEGMENT_ORDER_ROW_GAP * Math.max(0, NEWS_SEGMENT_ORDER.length - 1) + 20;

/** 4 rows + gaps; extra padding so last row is not clipped (FlatList viewport / card overflow). */
const QUOTES_SEGMENT_ORDER_ROW_GAP = 8;
const QUOTES_SEGMENT_ORDER_LIST_HEIGHT = 54 * 4 + QUOTES_SEGMENT_ORDER_ROW_GAP * 3 + 20;

const ACCENT_LABEL: Record<AccentPresetId, MessageId> = {
  green: 'accentGreen',
  red: 'accentRed',
  blue: 'accentBlue',
  yellow: 'accentYellow',
  orange: 'accentOrange',
  purple: 'accentPurple',
  cyan: 'accentCyan',
  teal: 'accentTeal',
  pink: 'accentPink',
  lime: 'accentLime',
  indigo: 'accentIndigo',
  rose: 'accentRose',
  custom: 'accentCustom',
};

const ACCENT_SWATCH_ROWS: AccentPresetId[][] = [
  ['green', 'red', 'blue', 'yellow', 'orange', 'purple'],
  ['cyan', 'teal', 'pink', 'lime', 'indigo', 'custom'],
];

const LOCALE_ORDER: AppLocale[] = ['ko', 'en', 'ja'];
const LOCALE_LABEL: Record<AppLocale, MessageId> = {
  ko: 'localeNameKo',
  en: 'localeNameEn',
  ja: 'localeNameJa',
};

const FONT_SIZE_PRESET_ORDER: FontSizePresetId[] = ['compact', 'small', 'standard', 'large', 'comfortable'];
const FONT_SIZE_PRESET_LABEL: Record<FontSizePresetId, MessageId> = {
  compact: 'settingsFontSizeCompact',
  small: 'settingsFontSizeSmall',
  standard: 'settingsFontSizeStandard',
  large: 'settingsFontSizeLarge',
  comfortable: 'settingsFontSizeComfortable',
};

const FEED_CONTENT_WEIGHT_ORDER = ['regular', 'bold'] as const satisfies readonly FeedContentWeightId[];
const FEED_CONTENT_WEIGHT_LABEL: Record<FeedContentWeightId, MessageId> = {
  regular: 'settingsFeedContentWeightRegular',
  bold: 'settingsFeedContentWeightBold',
};

const APPEARANCE_MODE_ORDER: ThemeAppearanceMode[] = ['system', 'light', 'dark'];
const APPEARANCE_MODE_LABEL: Record<ThemeAppearanceMode, MessageId> = {
  system: 'settingsAppearanceSystem',
  light: 'settingsAppearanceLight',
  dark: 'settingsAppearanceDark',
};

const MAIN_ENTRY_LABEL: Record<MainEntryKey, MessageId> = {
  news: 'settingsEntryNews',
  disclosures: 'screenDisclosures',
  signal: 'settingsEntrySignal',
  quotes: 'settingsEntryQuotes',
  more: 'settingsEntryMore',
};

const APP_ICON_LABEL: Record<AppIconVariant, MessageId> = {
  blue: 'settingsAppIconBlue',
  green: 'settingsAppIconGreen',
  dark: 'settingsAppIconDark',
  mono: 'settingsAppIconMono',
};

const APP_ICON_PREVIEW_IMAGE: Record<AppIconVariant, number> = {
  blue: require('@/assets/images/app-icon-blue.png'),
  green: require('@/assets/images/app-icon-green.png'),
  dark: require('@/assets/images/app-icon-dark.png'),
  mono: require('@/assets/images/app-icon-mono.png'),
};

const TAB_BAR_OPACITY_ORDER: TabBarOpacityLevel[] = [0, 1, 2, 3, 4];

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scrollFlex: { flex: 1 },
    scroll: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 32,
    },
    tabBar: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH - 32,
      alignSelf: 'center',
      flexShrink: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 6,
      backgroundColor: theme.bgElevated,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      gap: SEGMENT_TAB_GAP,
    },
    tabBtn: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 0,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
      paddingHorizontal: 8,
      borderRadius: SEGMENT_TAB_BTN_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBtnActive: {
      backgroundColor: theme.green,
    },
    tabText: {
      fontSize: sf(SEGMENT_TAB_FONT_SIZE),
      lineHeight: sf(SEGMENT_TAB_LINE_HEIGHT),
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    tabTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    lead: {
      fontSize: sf(14),
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: sf(21),
      marginBottom: 16,
    },
    card: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },
    cardTitle: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.textMuted,
      marginBottom: 6,
    },
    cardHint: {
      fontSize: sf(13),
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: sf(19),
    },
    prefRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      gap: 12,
    },
    prefLabel: { fontSize: sf(14), fontWeight: '600', color: theme.text, flex: 1 },
    prefBlock: { marginTop: 4, marginBottom: 4 },
    prefHint: { fontSize: sf(11), fontWeight: '500', color: theme.textDim, lineHeight: sf(15), marginTop: 2, marginBottom: 4 },
    notificationStack: { gap: 10, marginBottom: 20 },
    notificationCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    notificationText: { flex: 1, minWidth: 0 },
    notificationTitle: { fontSize: sf(14), fontWeight: '900', color: theme.text },
    notificationHint: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
      lineHeight: sf(16),
      marginTop: 3,
    },
    notificationSubRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    notificationSubRowDisabled: { opacity: 0.45 },
    notificationSubLabel: { flex: 1, fontSize: sf(13), fontWeight: '800', color: theme.textMuted },
    notificationSubHint: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
      lineHeight: sf(15),
      marginTop: 3,
    },
    notifIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginRight: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    notifSubIcon: {
      width: 16,
      textAlign: 'center',
      marginRight: 8,
    },
    section: {
      fontSize: sf(14),
      fontWeight: '800',
      color: theme.text,
      marginBottom: 8,
    },
    muted: { fontSize: sf(14), fontWeight: '500', color: theme.textMuted, marginBottom: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    handleText: { flex: 1, fontSize: sf(14), color: theme.text, fontWeight: '600' },
    removeBtn: { padding: 8 },
    hint: { fontSize: sf(12), fontWeight: '500', color: theme.textDim, marginBottom: 8 },
    addRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center' },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: sf(15),
      color: theme.text,
      backgroundColor: theme.card,
    },
    addBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.green,
    },
    addBtnText: { fontSize: sf(14), fontWeight: '800', color: '#FFFFFF' },
    resetBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      backgroundColor: theme.dangerDim,
    },
    resetBtnText: { fontSize: sf(13), fontWeight: '700', color: theme.danger },
    displayCard: {
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      overflow: 'hidden',
    },
    displayCardKicker: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    themePreviewShell: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      marginBottom: 6,
    },
    themePreviewLabel: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textDim,
      marginBottom: 8,
    },
    themePreviewBar: {
      height: 10,
      borderRadius: 5,
      marginBottom: 10,
    },
    themePreviewMockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    themePreviewMockDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
    },
    themePreviewMockTabs: {
      flexDirection: 'row',
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      opacity: 0.85,
    },
    themePreviewMockTab: {
      flex: 1,
      backgroundColor: theme.border,
    },
    themePreviewMockTabActive: {
      backgroundColor: theme.green,
    },
    themeSwatchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      marginBottom: 10,
    },
    themeSwatchRowLast: {
      marginBottom: 16,
    },
    themeSwatchOuter: {
      flex: 1,
      aspectRatio: 1,
      maxWidth: 52,
      minWidth: 0,
      borderRadius: 999,
      padding: 3,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeSwatchOuterActive: {
      borderColor: theme.greenBorder,
    },
    themeSwatchFill: {
      flex: 1,
      borderRadius: 999,
    },
    themeSwatchCustomPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    /** 커스텀 선택 시 색 위에 붓 표시(밝은/어두운 배경 모두 대비) */
    themeSwatchCustomBadgeOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeSwatchCustomBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.text,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    accentModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    accentModalSheet: {
      zIndex: 1,
      width: '100%',
      maxWidth: 340,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    accentModalTitle: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      fontSize: sf(15),
      fontWeight: '800',
      color: theme.text,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    accentModalHint: {
      paddingHorizontal: 8,
      paddingTop: 2,
      paddingBottom: 6,
      fontSize: sf(11),
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: sf(15),
    },
    accentPaletteScroll: {
      flexGrow: 1,
      paddingHorizontal: 3,
      paddingTop: 2,
      paddingBottom: 6,
    },
    accentPaletteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
    },
    accentSwatchCell: {
      borderRadius: 6,
      padding: 0,
      overflow: 'hidden',
    },
    accentSwatchInner: {
      position: 'relative',
      width: '100%',
      height: '100%',
      borderRadius: 6,
      overflow: 'hidden',
    },
    accentSwatchSelectedOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentSwatchSelectedBadge: {
      backgroundColor: theme.text,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    accentSwatchFill: {
      ...StyleSheet.absoluteFill,
      borderRadius: 6,
    },
    accentModalFooterActions: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 8,
      paddingTop: 10,
      paddingBottom: 6,
    },
    accentModalFooterBtnHalf: {
      flex: 1,
    },
    accentModalCancelBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    accentModalCancelBtnText: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
    },
    accentModalApplyBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 9,
      backgroundColor: theme.green,
    },
    accentModalApplyBtnText: {
      fontSize: sf(13),
      fontWeight: '800',
      color: '#FFFFFF',
    },
    displayAccentName: {
      textAlign: 'center',
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    langSegmentedTrack: {
      flexDirection: 'row',
      backgroundColor: theme.bgElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      gap: 4,
    },
    langSegment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    langSegmentDisabled: {
      opacity: 0.38,
    },
    langSegmentActive: {
      backgroundColor: theme.green,
    },
    langSegmentText: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.textDim,
      textAlign: 'center',
    },
    langSegmentTextActive: {
      color: '#FFFFFF',
    },
    /** 개발자 푸터 내부(플로팅 글래스 캡슐 위) */
    settingsFooterPress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    settingsFooterAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    settingsFooterText: {
      flexShrink: 1,
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
      letterSpacing: 0.2,
    },
    cacheOneLiner: {
      fontSize: sf(12),
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: sf(17),
      marginBottom: 10,
    },
    cacheClearBtn: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    cacheClearBtnText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
    cacheClearSuccess: {
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.green,
      lineHeight: sf(17),
      textAlign: 'center',
    },
    limitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    limitRowLast: {
      marginBottom: 0,
    },
    quotesCardHint: {
      fontSize: sf(12),
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: sf(17),
      marginBottom: 12,
    },
    quotesSegmentOrderListWrap: {
      marginBottom: 2,
    },
    quotesSegmentOrderListContent: {
      paddingBottom: 8,
    },
    quotesChangeColorSegment: {
      flexDirection: 'column',
      gap: 8,
      marginBottom: 12,
    },
    quotesChangeColorOption: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    quotesChangeColorOptionActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    quotesChangeColorOptionTitle: {
      fontSize: sf(14),
      fontWeight: '800',
      color: theme.text,
    },
    quotesChangeColorOptionTitleActive: {
      color: theme.green,
    },
    quotesChangeColorOptionDesc: {
      marginTop: 4,
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
      lineHeight: sf(16),
    },
    quotesChangeColorPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginTop: 4,
    },
    quotesChangeColorPreviewChip: {
      fontSize: sf(15),
      fontWeight: '900',
      letterSpacing: -0.2,
    },
    limitPickerTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      minWidth: 88,
      justifyContent: 'flex-end',
    },
    limitPickerTriggerText: {
      fontSize: sf(15),
      fontWeight: '800',
      color: theme.text,
    },
    limitPickerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    limitPickerSheet: {
      zIndex: 1,
      width: '100%',
      maxWidth: 320,
      maxHeight: '56%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      overflow: 'hidden',
    },
    limitPickerTitle: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: sf(15),
      fontWeight: '800',
      color: theme.text,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    limitPickerScroll: {
      maxHeight: 320,
    },
    limitPickerOption: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    limitPickerOptionActive: {
      backgroundColor: theme.greenDim,
    },
    limitPickerOptionText: {
      fontSize: sf(16),
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    limitPickerOptionTextActive: {
      color: theme.green,
    },
    segmentOrderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    segmentOrderRowGap: {
      marginBottom: QUOTES_SEGMENT_ORDER_ROW_GAP,
    },
    segmentOrderRowActive: {
      borderColor: theme.green + '88',
      backgroundColor: theme.greenDim,
    },
    segmentOrderLabel: {
      flex: 1,
      fontSize: sf(15),
      fontWeight: '800',
      color: theme.text,
    },
    segmentOrderDragHandle: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginRight: -4,
    },
    appIconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 2,
    },
    appIconOption: {
      width: '48%',
      minWidth: 128,
      flexGrow: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      gap: 10,
    },
    appIconOptionActive: {
      borderColor: theme.green,
      backgroundColor:
        theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}12` : theme.greenDim,
    },
    appIconPreview: {
      width: 46,
      height: 46,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    appIconPreviewImage: {
      width: '100%',
      height: '100%',
    },
    appIconLabel: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '900',
      color: theme.text,
    },
  });
}

/** 하단 플로팅 개발자 바 높이(탭바 캡슐과 비슷하게) */
const SETTINGS_DEV_FOOTER_INNER_MIN_HEIGHT = 52;

export default function SettingsScreen() {
  const {
    theme,
    effectiveColorScheme,
    appearanceMode,
    setAppearanceMode,
    presetId,
    setPresetId,
    customHex,
    setCustomAccent,
    fontSizePreset,
    setFontSizePreset,
    feedContentWeight,
    setFeedContentWeight,
    scaleFont,
  } = useSignalTheme();
  const { t, locale, setLocale } = useLocale();
  const { useTwoPane } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const params = useLocalSearchParams<{ tab?: string; from?: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const useIpadSidebar = useTwoPane && params.from === 'more';
  const [tab, setTab] = useState<SettingsTab>('display');

  const [pushEnabled, setPushEnabled] = useState(true);
  const [briefingPushEnabled, setBriefingPushEnabled] = useState(true);
  const [localMacroCalendar, setLocalMacroCalendar] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [newsUnreadCheckMinutes, setNewsUnreadCheckMinutes] = useState(5);
  const [newsUnreadIntervalReady, setNewsUnreadIntervalReady] = useState(false);

  const [memoryCacheClearNotice, setMemoryCacheClearNotice] = useState(false);
  const memoryCacheClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [quotesListLimits, setQuotesListLimits] = useState<QuotesListLimits>(() =>
    normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS),
  );
  const [quotesLimitsReady, setQuotesLimitsReady] = useState(false);
  const [quotesSegmentOrder, setQuotesSegmentOrder] =
    useState<QuoteSegmentKey[]>(DEFAULT_QUOTES_SEGMENT_ORDER);
  const [quotesSegmentOrderReady, setQuotesSegmentOrderReady] = useState(false);
  const [quotesChangeColorConvention, setQuotesChangeColorConvention] =
    useState<QuotesChangeColorConvention>('korea');
  const [quotesChangeColorReady, setQuotesChangeColorReady] = useState(false);
  const [quotesLimitPicker, setQuotesLimitPicker] = useState<'popular' | 'mcap' | 'coin' | null>(null);

  const [newsSegmentOrder, setNewsSegmentOrder] = useState<NewsSegmentKey[]>([...NEWS_SEGMENT_ORDER]);
  const [newsSegmentOrderReady, setNewsSegmentOrderReady] = useState(false);
  const [newsHashtagDisplayMax, setNewsHashtagDisplayMax] = useState(DEFAULT_NEWS_HASHTAG_DISPLAY_MAX);
  const [newsHashtagDisplayReady, setNewsHashtagDisplayReady] = useState(false);
  const [signalServerMode, setSignalServerMode] = useState<SignalServerMode>('bundle');
  const [signalCustomDraft, setSignalCustomDraft] = useState('');
  const [signalServerPrefsReady, setSignalServerPrefsReady] = useState(false);
  const [signalServerVerifying, setSignalServerVerifying] = useState(false);

  const [moreRefLinksVisible, setMoreRefLinksVisible] = useState(true);
  const [moreRefLinksReady, setMoreRefLinksReady] = useState(false);
  const [mainEntry, setMainEntry] = useState<MainEntryKey>('news');
  const [mainEntryReady, setMainEntryReady] = useState(false);
  const [appIconVariant, setAppIconVariant] = useState<AppIconVariant>('blue');
  const [appIconReady, setAppIconReady] = useState(false);
  const [tabBarOpacityLevel, setTabBarOpacityLevel] = useState<TabBarOpacityLevel>(3);
  const [tabBarOpacityReady, setTabBarOpacityReady] = useState(false);

  const claudeAvailable = false;
  const openaiAvailable = false;

  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [accentPickerDraftHex, setAccentPickerDraftHex] = useState(customHex);

  const openAccentPicker = useCallback(() => {
    setAccentPickerDraftHex(customHex);
    setAccentPickerOpen(true);
  }, [customHex]);

  const { width: winW, height: winH } = useWindowDimensions();
  const floatingFooterMarginH = tabBarHorizontalMargin();
  const floatingFooterWidth = Math.min(winW - floatingFooterMarginH * 2, APP_CONTENT_MAX_WIDTH);
  const floatingFooterLeft = Math.max(floatingFooterMarginH, (winW - floatingFooterWidth) / 2);
  const accentPickerLayout = useMemo(() => {
    const sheetW = Math.min(winW - 40, 340);
    const cols = ACCENT_PALETTE_COLS;
    const gap = 2;
    const pad = 3;
    const inner = sheetW - pad * 2;
    const cell = Math.max(4, (inner - gap * (cols - 1)) / cols);
    const paletteScrollMaxH = Math.min(
      Math.ceil(
        ACCENT_PALETTE_ROWS * cell + (ACCENT_PALETTE_ROWS - 1) * gap + 12,
      ),
      Math.round(winH * 0.42),
      380,
    );
    const maxSheetH = Math.min(Math.round(winH * 0.86), winH - 24);
    return { sheetW, cols, gap, cell, paletteScrollMaxH, maxSheetH, gridInnerW: inner };
  }, [winW, winH]);

  const accentSwatchPalette = useMemo(() => buildRainbowKoreanAccentPalette(), []);

  const quotesPickerOptions = useMemo(() => {
    if (!quotesLimitPicker) return [];
    return quotesListCountChoicesForField(quotesLimitPicker);
  }, [quotesLimitPicker]);

  const quotesChangeColorPreview = useMemo(
    () => getQuoteChangeColors(quotesChangeColorConvention, effectiveColorScheme),
    [quotesChangeColorConvention, effectiveColorScheme],
  );

  const scrollContentBottomPad = useMemo(
    () =>
      32 +
      tabBarBottomInset(insets.bottom) +
      SETTINGS_DEV_FOOTER_INNER_MIN_HEIGHT +
      12,
    [insets.bottom],
  );

  useEffect(() => {
    const raw = params.tab;
    const tabParam = Array.isArray(raw) ? raw[0] : raw;
    if (
      tabParam === 'news' ||
      tabParam === 'quotes' ||
      tabParam === 'display' ||
      tabParam === 'notifications' ||
      tabParam === 'server'
    ) {
      setTab(tabParam);
    }
  }, [params.tab]);

  useEffect(() => {
    return () => {
      if (memoryCacheClearTimerRef.current) {
        clearTimeout(memoryCacheClearTimerRef.current);
        memoryCacheClearTimerRef.current = null;
      }
    };
  }, []);

  const reloadPrefs = useCallback(async () => {
    const [p, newsIntervalMin] = await Promise.all([
      loadNotificationPrefs(),
      loadNewsUnreadCheckIntervalMinutes(),
    ]);
    setPushEnabled(p.pushEnabled);
    setBriefingPushEnabled(p.briefingPushEnabled);
    setLocalMacroCalendar(p.localMacroCalendar);
    setNewsUnreadCheckMinutes(newsIntervalMin);
    setNewsUnreadIntervalReady(true);    setPrefsReady(true);
  }, []);

  const syncLocalCalendarNotifications = useCallback(async (prefs?: NotificationPrefs) => {
    const p = prefs ?? (await loadNotificationPrefs());
    await syncCalendarLocalReminders(p);
  }, []);

  const reloadQuotesListLimits = useCallback(async () => {
    const p = await loadQuotesListLimits();
    setQuotesListLimits(p);
    setQuotesLimitsReady(true);
  }, []);

  const reloadQuotesSegmentOrder = useCallback(async () => {
    const o = await loadQuotesSegmentOrder();
    setQuotesSegmentOrder(o);
    setQuotesSegmentOrderReady(true);
  }, []);

  const reloadQuotesChangeColorConvention = useCallback(async () => {
    const c = await loadQuotesChangeColorConvention();
    setQuotesChangeColorConvention(c);
    setQuotesChangeColorReady(true);
  }, []);

  const reloadNewsSegmentOrder = useCallback(async () => {
    const o = await loadNewsSegmentOrder();
    setNewsSegmentOrder(o);
    setNewsSegmentOrderReady(true);
  }, []);

  const reloadNewsHashtagDisplayMax = useCallback(async () => {
    const v = await loadNewsHashtagDisplayMax();
    setNewsHashtagDisplayMax(v);
    setNewsHashtagDisplayReady(true);
  }, []);

  const reloadSignalServerPrefs = useCallback(async () => {
    const p = await loadSignalServerPrefs();
    setSignalServerMode(p.mode);
    setSignalCustomDraft(p.customUrl);
    setSignalServerPrefsReady(true);
  }, []);

  const bumpNewsHashtagDisplayMax = useCallback(async (delta: number) => {
    const v = await loadNewsHashtagDisplayMax();
    const next = Math.min(
      MAX_NEWS_HASHTAG_DISPLAY_MAX,
      Math.max(MIN_NEWS_HASHTAG_DISPLAY_MAX, v + delta),
    );
    await saveNewsHashtagDisplayMax(next);
    setNewsHashtagDisplayMax(next);
  }, []);

  const onPickSignalServerMode = useCallback(
    async (m: SignalServerMode) => {
      if (signalServerVerifying) return;
      if (m === 'custom') {
        const u = signalCustomDraft.trim();
        if (!u) {
          Alert.alert(t('alertTitleInputError'), t('settingsSignalServerCustomEmpty'));
          return;
        }
      }
      const target = resolveSignalServerProbeTarget(m, signalCustomDraft);
      setSignalServerVerifying(true);
      try {
        await probeSignalServerBaseUrl(target);
        if (m === 'custom') {
          await saveSignalServerPrefs({ mode: 'custom', customUrl: signalCustomDraft.trim() });
        } else {
          await saveSignalServerPrefs({ mode: m });
        }
        clearSignalApiCache();
        await reloadSignalServerPrefs();
      } catch (e) {
        let body = e instanceof Error ? e.message : String(e);
        if (e instanceof Error && e.name === 'AbortError') {
          body = t('settingsSignalServerProbeTimeout');
        } else if (e instanceof Error && body === 'EMPTY_URL') {
          body = t('settingsSignalServerBundleEmpty');
        }
        Alert.alert(t('settingsSignalServerProbeFailTitle'), body);
      } finally {
        setSignalServerVerifying(false);
      }
    },
    [reloadSignalServerPrefs, signalCustomDraft, signalServerVerifying, t],
  );

  const reloadMoreReferenceLinksPref = useCallback(async () => {
    const v = await loadMoreReferenceLinksVisible();
    setMoreRefLinksVisible(v);
    setMoreRefLinksReady(true);
  }, []);

  const reloadMainEntryPref = useCallback(async () => {
    const v = await loadMainEntry();
    setMainEntry(v);
    setMainEntryReady(true);
  }, []);

  const reloadAppIconPref = useCallback(async () => {
    const v = await loadAppIconVariant();
    setAppIconVariant(v);
    setAppIconReady(true);
  }, []);

  const reloadTabBarOpacityPref = useCallback(async () => {
    const v = await loadTabBarOpacityLevel();
    setTabBarOpacityLevel(v);
    setTabBarOpacityReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadPrefs();
      void reloadQuotesListLimits();
      void reloadQuotesSegmentOrder();
      void reloadQuotesChangeColorConvention();
      void reloadNewsSegmentOrder();
      void reloadNewsHashtagDisplayMax();
      void reloadSignalServerPrefs();
      void reloadMoreReferenceLinksPref();
      void reloadMainEntryPref();
      void reloadAppIconPref();
      void reloadTabBarOpacityPref();
    }, [
      reloadPrefs,
      reloadQuotesListLimits,
      reloadQuotesSegmentOrder,
      reloadQuotesChangeColorConvention,
      reloadNewsSegmentOrder,
      reloadNewsHashtagDisplayMax,
      reloadSignalServerPrefs,
      reloadMoreReferenceLinksPref,
      reloadMainEntryPref,
      reloadAppIconPref,
      reloadTabBarOpacityPref,
    ]),
  );

  const onClearAllCaches = () => {
    clearYoutubeCache();
clearCalendarCache();
    clearQuotesCache();
    clearNewsCache();
    clearSignalApiCache();
    if (Platform.OS === 'web') {
      if (memoryCacheClearTimerRef.current) {
        clearTimeout(memoryCacheClearTimerRef.current);
        memoryCacheClearTimerRef.current = null;
      }
      setMemoryCacheClearNotice(true);
      memoryCacheClearTimerRef.current = setTimeout(() => {
        memoryCacheClearTimerRef.current = null;
        setMemoryCacheClearNotice(false);
      }, 4500);
    } else {
      Alert.alert(t('settingsCacheClearedTitle'), t('settingsCacheClearedBody'));
    }
  };

  const screen = (
    /** 상단 edge 없음 — 스택 헤더가 이미 안전 영역을 처리해 `edges.top`을 쓰면 헤더 아래 빈 여백이 커짐 */
    <SafeAreaView style={styles.safe} edges={[]}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.tabBar}>
        {SETTINGS_TABS.map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabBtn, selected && styles.tabBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}>
              <Text
                style={[styles.tabText, selected && styles.tabTextActive]}
                numberOfLines={1}>
                {t(item.labelId)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollContentBottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {tab === 'quotes' ? (
          <>
            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsQuotesChangeColorKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsQuotesChangeColorHint')}</Text>
              {!quotesChangeColorReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <View style={styles.quotesChangeColorSegment}>
                    {QUOTES_CHANGE_COLOR_CONVENTION_ORDER.map((convention) => {
                      const selected = quotesChangeColorConvention === convention;
                      return (
                        <Pressable
                          key={convention}
                          onPress={() => {
                            setQuotesChangeColorConvention(convention);
                            void saveQuotesChangeColorConvention(convention);
                          }}
                          style={[
                            styles.quotesChangeColorOption,
                            selected && styles.quotesChangeColorOptionActive,
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={t(QUOTES_CHANGE_COLOR_LABEL[convention])}>
                          <Text
                            style={[
                              styles.quotesChangeColorOptionTitle,
                              selected && styles.quotesChangeColorOptionTitleActive,
                            ]}>
                            {t(QUOTES_CHANGE_COLOR_LABEL[convention])}
                          </Text>
                          <Text style={styles.quotesChangeColorOptionDesc}>
                            {t(QUOTES_CHANGE_COLOR_DESC[convention])}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.quotesChangeColorPreviewRow}>
                    <Text
                      style={[
                        styles.quotesChangeColorPreviewChip,
                        { color: quotesChangeColorPreview.up },
                      ]}>
                      {t('settingsQuotesChangeColorPreviewUp')}
                    </Text>
                    <Text
                      style={[
                        styles.quotesChangeColorPreviewChip,
                        { color: quotesChangeColorPreview.down },
                      ]}>
                      {t('settingsQuotesChangeColorPreviewDown')}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsQuotesSegmentOrderKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsQuotesSegmentOrderHint')}</Text>
              {!quotesSegmentOrderReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={styles.quotesSegmentOrderListWrap}>
                  <DraggableFlatList
                    data={quotesSegmentOrder}
                    scrollEnabled={false}
                    removeClippedSubviews={false}
                    style={{ height: QUOTES_SEGMENT_ORDER_LIST_HEIGHT }}
                    containerStyle={{ flexGrow: 0 }}
                    contentContainerStyle={styles.quotesSegmentOrderListContent}
                    keyExtractor={(item) => item}
                    onDragEnd={({ data }) => {
                      setQuotesSegmentOrder(data);
                      void saveQuotesSegmentOrder(data);
                    }}
                    renderItem={({ item, drag, isActive, getIndex }) => {
                      const idx = getIndex() ?? 0;
                      const isLast = idx === quotesSegmentOrder.length - 1;
                      return (
                        <ScaleDecorator>
                          <View
                            style={[
                              styles.segmentOrderRow,
                              !isLast && styles.segmentOrderRowGap,
                              isActive && styles.segmentOrderRowActive,
                            ]}>
                            <Text style={styles.segmentOrderLabel}>{t(QUOTE_SEGMENT_LABEL[item])}</Text>
                            <GHPressable
                              style={styles.segmentOrderDragHandle}
                              {...(Platform.OS === 'web'
                                ? { onPressIn: drag }
                                : { onLongPress: drag, delayLongPress: 200 })}
                              accessibilityRole="button"
                              accessibilityLabel={formatMessage(t('settingsQuotesSegmentDragHandleA11y'), {
                                name: t(QUOTE_SEGMENT_LABEL[item]),
                              })}>
                              <FontAwesome name="bars" size={16} color={theme.textMuted} />
                            </GHPressable>
                          </View>
                        </ScaleDecorator>
                      );
                    }}
                  />
                </View>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsQuotesLimitsKicker')}</Text>
              <Text style={styles.quotesCardHint}>
                {formatMessage(t('settingsQuotesListLimitsHint'), {
                  popMax: QUOTES_LIST_LIMIT_BOUNDS.popular.max,
                  mcapMax: QUOTES_LIST_LIMIT_BOUNDS.mcap.max,
                  coinMax: QUOTES_LIST_LIMIT_BOUNDS.coin.max,
                })}
              </Text>
              {!quotesLimitsReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <View style={styles.limitRow}>
                    <Text style={styles.prefLabel}>{t('settingsQuotesPopularCountLabel')}</Text>
                    <Pressable
                      onPress={() => setQuotesLimitPicker('popular')}
                      style={styles.limitPickerTrigger}
                      accessibilityRole="button"
                      accessibilityLabel={t('settingsQuotesPopularCountLabel')}>
                      <Text style={styles.limitPickerTriggerText}>{quotesListLimits.popularMax}</Text>
                      <FontAwesome name="chevron-down" size={14} color={theme.green} />
                    </Pressable>
                  </View>
                  <View style={styles.limitRow}>
                    <Text style={styles.prefLabel}>{t('settingsQuotesMcapCountLabel')}</Text>
                    <Pressable
                      onPress={() => setQuotesLimitPicker('mcap')}
                      style={styles.limitPickerTrigger}
                      accessibilityRole="button"
                      accessibilityLabel={t('settingsQuotesMcapCountLabel')}>
                      <Text style={styles.limitPickerTriggerText}>{quotesListLimits.mcapMax}</Text>
                      <FontAwesome name="chevron-down" size={14} color={theme.green} />
                    </Pressable>
                  </View>
                  <View style={[styles.limitRow, styles.limitRowLast]}>
                    <Text style={styles.prefLabel}>{t('settingsQuotesCoinCountLabel')}</Text>
                    <Pressable
                      onPress={() => setQuotesLimitPicker('coin')}
                      style={styles.limitPickerTrigger}
                      accessibilityRole="button"
                      accessibilityLabel={t('settingsQuotesCoinCountLabel')}>
                      <Text style={styles.limitPickerTriggerText}>{quotesListLimits.coinMax}</Text>
                      <FontAwesome name="chevron-down" size={14} color={theme.green} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </>
        ) : null}

        {tab === 'news' ? (
          <>
            <Text style={styles.lead}>{t('settingsNewsTabLead')}</Text>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsNewsSegmentOrderKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsNewsSegmentOrderHint')}</Text>
              {!newsSegmentOrderReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={styles.quotesSegmentOrderListWrap}>
                  <DraggableFlatList
                    data={newsSegmentOrder}
                    scrollEnabled={false}
                    removeClippedSubviews={false}
                    style={{ height: NEWS_SEGMENT_ORDER_LIST_HEIGHT }}
                    containerStyle={{ flexGrow: 0 }}
                    contentContainerStyle={styles.quotesSegmentOrderListContent}
                    keyExtractor={(item) => item}
                    onDragEnd={({ data }) => {
                      setNewsSegmentOrder(data);
                      void saveNewsSegmentOrder(data);
                    }}
                    renderItem={({ item, drag, isActive, getIndex }) => {
                      const idx = getIndex() ?? 0;
                      const isLast = idx === newsSegmentOrder.length - 1;
                      return (
                        <ScaleDecorator>
                          <View
                            style={[
                              styles.segmentOrderRow,
                              !isLast && styles.segmentOrderRowGap,
                              isActive && styles.segmentOrderRowActive,
                            ]}>
                            <Text style={styles.segmentOrderLabel}>{t(NEWS_FEED_SEGMENT_LABEL[item])}</Text>
                            <GHPressable
                              style={styles.segmentOrderDragHandle}
                              {...(Platform.OS === 'web'
                                ? { onPressIn: drag }
                                : { onLongPress: drag, delayLongPress: 200 })}
                              accessibilityRole="button"
                              accessibilityLabel={formatMessage(t('settingsNewsSegmentDragHandleA11y'), {
                                name: t(NEWS_FEED_SEGMENT_LABEL[item]),
                              })}>
                              <FontAwesome name="bars" size={16} color={theme.textMuted} />
                            </GHPressable>
                          </View>
                        </ScaleDecorator>
                      );
                    }}
                  />
                </View>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsNewsHashtagDisplayKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsNewsHashtagDisplayHint')}</Text>
              {!newsHashtagDisplayReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={[styles.row, { marginTop: 8 }]}>
                  <Text style={styles.handleText}>
                    {t('settingsNewsHashtagDisplayValue', { max: newsHashtagDisplayMax })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => void bumpNewsHashtagDisplayMax(-1)}
                      disabled={newsHashtagDisplayMax <= MIN_NEWS_HASHTAG_DISPLAY_MAX}
                      style={({ pressed }) => [
                        styles.addBtn,
                        (newsHashtagDisplayMax <= MIN_NEWS_HASHTAG_DISPLAY_MAX || pressed) && { opacity: 0.55 },
                      ]}
                      accessibilityRole="button">
                      <Text style={styles.addBtnText}>−</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void bumpNewsHashtagDisplayMax(1)}
                      disabled={newsHashtagDisplayMax >= MAX_NEWS_HASHTAG_DISPLAY_MAX}
                      style={({ pressed }) => [
                        styles.addBtn,
                        (newsHashtagDisplayMax >= MAX_NEWS_HASHTAG_DISPLAY_MAX || pressed) && { opacity: 0.55 },
                      ]}
                      accessibilityRole="button">
                      <Text style={styles.addBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsNewsUnreadCheckKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsNewsUnreadCheckHint')}</Text>
              {!newsUnreadIntervalReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={[styles.langSegmentedTrack, { marginTop: 8 }]}>
                  {NEWS_UNREAD_CHECK_INTERVAL_OPTIONS.map((minutes) => (
                    <Pressable
                      key={minutes}
                      onPress={() => {
                        setNewsUnreadCheckMinutes(minutes);
                        void saveNewsUnreadCheckIntervalMinutes(minutes);
                      }}
                      style={[
                        styles.langSegment,
                        newsUnreadCheckMinutes === minutes && styles.langSegmentActive,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: newsUnreadCheckMinutes === minutes }}
                      accessibilityLabel={t('settingsNewsUnreadCheckOption', {
                        minutes: String(minutes),
                      })}>
                      <Text
                        style={[
                          styles.langSegmentText,
                          newsUnreadCheckMinutes === minutes && styles.langSegmentTextActive,
                        ]}>
                        {t('settingsNewsUnreadCheckOption', { minutes: String(minutes) })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

          </>
        ) : null}

        {tab === 'notifications' ? (
          <>
            <Text style={styles.lead}>{t('settingsNotificationsLead')}</Text>
            {!prefsReady ? (
              <Text style={styles.muted}>{t('commonLoading')}</Text>
            ) : (
              <View style={styles.notificationStack}>
                {/* 서버 푸시 카드 */}
                <View style={styles.notificationCard}>
                  <View style={styles.notificationHeader}>
                    <View style={[styles.notifIconBadge, { backgroundColor: theme.greenDim, borderColor: theme.greenBorder }]}>
                      <FontAwesome name="bell" size={18} color={theme.green} />
                    </View>
                    <View style={styles.notificationText}>
                      <Text style={styles.notificationTitle}>{t('settingsPushEnabled')}</Text>
                      <Text style={styles.notificationHint}>{t('settingsPushEnabledHint')}</Text>
                    </View>
                    <Switch
                      value={pushEnabled}
                      onValueChange={async (v) => {
                        setPushEnabled(v);
                        await saveNotificationPrefs({ pushEnabled: v });
                        if (v) void registerPushDeviceIfPossible();
                      }}
                      trackColor={{ false: '#333', true: theme.green + '88' }}
                      thumbColor={pushEnabled ? theme.green : '#888'}
                    />
                  </View>
                  <View style={[styles.notificationSubRow, !pushEnabled && styles.notificationSubRowDisabled]}>
                    <FontAwesome name="bar-chart" size={12} color={theme.textMuted} style={styles.notifSubIcon} />
                    <View style={styles.notificationText}>
                      <Text style={styles.notificationSubLabel}>{t('settingsBriefingPushEnabled')}</Text>
                      <Text style={styles.notificationSubHint}>{t('settingsBriefingPushEnabledHint')}</Text>
                    </View>
                    <Switch
                      value={briefingPushEnabled}
                      disabled={!pushEnabled}
                      onValueChange={async (v) => {
                        setBriefingPushEnabled(v);
                        await saveNotificationPrefs({ briefingPushEnabled: v });
                      }}
                      trackColor={{ false: '#333', true: theme.green + '88' }}
                      thumbColor={briefingPushEnabled && pushEnabled ? theme.green : '#888'}
                    />
                  </View>
                </View>

                {/* 로컬 알림 · 경제 캘린더 카드 */}
                <View style={styles.notificationCard}>
                  <View style={styles.notificationHeader}>
                    <View style={styles.notifIconBadge}>
                      <FontAwesome name="calendar" size={16} color={theme.textDim} />
                    </View>
                    <View style={styles.notificationText}>
                      <Text style={styles.notificationTitle}>{t('settingsLocalMacroCalendar')}</Text>
                      <Text style={styles.notificationHint}>{t('settingsLocalMacroCalendarHint')}</Text>
                    </View>
                    <Switch
                      value={localMacroCalendar}
                      onValueChange={async (v) => {
                        setLocalMacroCalendar(v);
                        const next = {
                          pushEnabled,
                          briefingPushEnabled,
                          localMacroCalendar: v,
                        };
                        await saveNotificationPrefs(next);
                        await syncLocalCalendarNotifications(next);
                      }}
                      trackColor={{ false: '#333', true: theme.green + '88' }}
                      thumbColor={localMacroCalendar ? theme.green : '#888'}
                    />
                  </View>
                </View>
              </View>
            )}
          </>
        ) : null}

        {tab === 'server' ? (
          <>
            <View style={styles.displayCard}>
              <Text
                style={[styles.handleText, { marginBottom: 6 }]}
                selectable
                accessibilityRole="text"
                accessibilityLabel={formatMessage(t('settingsSignalServerUrlA11y'), {
                  url: getEffectiveSignalApiBaseUrl() || '—',
                })}>
                {getEffectiveSignalApiBaseUrl() || '—'}
              </Text>
              <Text style={[styles.muted, { fontSize: 12, lineHeight: 17, marginBottom: 10 }]}>
                {t('settingsSignalServerShortNote')}
              </Text>
              {!signalServerPrefsReady ? (
                <Text style={[styles.muted, { marginTop: 10 }]}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <View style={[styles.langSegmentedTrack, { marginTop: 0, flexWrap: 'wrap' }]}>
                    {SIGNAL_SERVER_MODES.map((m) => (
                      <Pressable
                        key={m}
                        disabled={signalServerVerifying}
                        onPress={() => void onPickSignalServerMode(m)}
                        style={[
                          styles.langSegment,
                          signalServerMode === m && styles.langSegmentActive,
                          signalServerVerifying && { opacity: 0.45 },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected: signalServerMode === m,
                          disabled: signalServerVerifying,
                        }}
                        accessibilityLabel={t(SIGNAL_SERVER_LABEL[m])}>
                        <Text
                          style={[
                            styles.langSegmentText,
                            signalServerMode === m && styles.langSegmentTextActive,
                          ]}>
                          {t(SIGNAL_SERVER_LABEL[m])}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {signalServerVerifying ? (
                    <View
                      style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                      accessibilityLiveRegion="polite">
                      <ActivityIndicator size="small" color={theme.text} />
                      <Text style={styles.muted}>{t('settingsSignalServerVerifying')}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.prefHint, { marginTop: 12 }]}>{t('settingsSignalServerCustomLabel')}</Text>
                  <TextInput
                    value={signalCustomDraft}
                    onChangeText={setSignalCustomDraft}
                    editable={!signalServerVerifying}
                    placeholder={t('settingsSignalServerCustomPlaceholder')}
                    placeholderTextColor={theme.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={[styles.input, { marginTop: 6 }]}
                  />
                </>
              )}
            </View>
          </>
        ) : null}

        {tab === 'display' ? (
          <>
            <Text style={styles.lead}>{t('settingsThemeLead')}</Text>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsThemeLanguageSection')}</Text>
              <View style={styles.langSegmentedTrack}>
                {LOCALE_ORDER.map((loc) => (
                  <Pressable
                    key={loc}
                    onPress={() => void setLocale(loc)}
                    style={[styles.langSegment, locale === loc && styles.langSegmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: locale === loc }}
                    accessibilityLabel={t(LOCALE_LABEL[loc])}>
                    <Text
                      style={[styles.langSegmentText, locale === loc && styles.langSegmentTextActive]}>
                      {t(LOCALE_LABEL[loc])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsMainEntrySection')}</Text>
              <Text style={styles.prefHint}>{t('settingsMainEntryHint')}</Text>
              {!mainEntryReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={styles.langSegmentedTrack}>
                  {MAIN_ENTRY_DISPLAY_ORDER.map((entry) => (
                    <Pressable
                      key={entry}
                      onPress={() => {
                        setMainEntry(entry);
                        void saveMainEntry(entry);
                      }}
                      style={[styles.langSegment, mainEntry === entry && styles.langSegmentActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: mainEntry === entry }}
                      accessibilityLabel={t(MAIN_ENTRY_LABEL[entry])}>
                      <Text
                        style={[
                          styles.langSegmentText,
                          mainEntry === entry && styles.langSegmentTextActive,
                        ]}>
                        {t(MAIN_ENTRY_LABEL[entry])}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsAppearanceSection')}</Text>
              <View style={styles.langSegmentedTrack}>
                {APPEARANCE_MODE_ORDER.map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => void setAppearanceMode(mode)}
                    style={[styles.langSegment, appearanceMode === mode && styles.langSegmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: appearanceMode === mode }}
                    accessibilityLabel={t(APPEARANCE_MODE_LABEL[mode])}>
                    <Text
                      style={[
                        styles.langSegmentText,
                        appearanceMode === mode && styles.langSegmentTextActive,
                      ]}>
                      {t(APPEARANCE_MODE_LABEL[mode])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsAppIconSection')}</Text>
              <Text style={styles.prefHint}>{t('settingsAppIconHint')}</Text>
              {!appIconReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <View style={styles.appIconGrid}>
                    {APP_ICON_VARIANTS.map((variant) => (
                      <Pressable
                        key={variant.id}
                        onPress={() => {
                          setAppIconVariant(variant.id);
                          void saveAppIconVariant(variant.id);
                        }}
                        style={[
                          styles.appIconOption,
                          appIconVariant === variant.id && styles.appIconOptionActive,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: appIconVariant === variant.id }}
                        accessibilityLabel={t(APP_ICON_LABEL[variant.id])}>
                        <View
                          style={[
                            styles.appIconPreview,
                            { backgroundColor: variant.background },
                          ]}>
                          <Image
                            source={APP_ICON_PREVIEW_IMAGE[variant.id]}
                            style={styles.appIconPreviewImage}
                          />
                        </View>
                        <Text style={styles.appIconLabel}>{t(APP_ICON_LABEL[variant.id])}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[styles.prefHint, { marginTop: 10 }]}>
                    {t('settingsAppIconNativeNote')}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsTabBarOpacitySection')}</Text>
              <Text style={styles.prefHint}>{t('settingsTabBarOpacityHint')}</Text>
              {!tabBarOpacityReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={styles.langSegmentedTrack}>
                  {TAB_BAR_OPACITY_ORDER.map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => {
                        setTabBarOpacityLevel(level);
                        void saveTabBarOpacityLevel(level);
                      }}
                      style={[
                        styles.langSegment,
                        tabBarOpacityLevel === level && styles.langSegmentActive,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: tabBarOpacityLevel === level }}
                      accessibilityLabel={t('settingsTabBarOpacityOption', {
                        percent: tabBarOpacityPercent(level),
                      })}>
                      <Text
                        style={[
                          styles.langSegmentText,
                          tabBarOpacityLevel === level && styles.langSegmentTextActive,
                        ]}>
                        {tabBarOpacityPercent(level)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsFontSizeSection')}</Text>
              <Text style={styles.prefHint}>{t('settingsFontSizeHint')}</Text>
              <View style={styles.langSegmentedTrack}>
                {FONT_SIZE_PRESET_ORDER.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => void setFontSizePreset(id)}
                    style={[styles.langSegment, fontSizePreset === id && styles.langSegmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: fontSizePreset === id }}
                    accessibilityLabel={t(FONT_SIZE_PRESET_LABEL[id])}>
                    <Text
                      style={[
                        styles.langSegmentText,
                        fontSizePreset === id && styles.langSegmentTextActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}>
                      {t(FONT_SIZE_PRESET_LABEL[id])}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.displayCardKicker, { marginTop: 16 }]}>
                {t('settingsFeedContentWeightSection')}
              </Text>
              <Text style={styles.prefHint}>{t('settingsFeedContentWeightHint')}</Text>
              <View style={styles.langSegmentedTrack}>
                {FEED_CONTENT_WEIGHT_ORDER.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => void setFeedContentWeight(id)}
                    style={[styles.langSegment, feedContentWeight === id && styles.langSegmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: feedContentWeight === id }}
                    accessibilityLabel={t(FEED_CONTENT_WEIGHT_LABEL[id])}>
                    <Text
                      style={[
                        styles.langSegmentText,
                        feedContentWeight === id && styles.langSegmentTextActive,
                      ]}>
                      {t(FEED_CONTENT_WEIGHT_LABEL[id])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsMoreReferenceLinksKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsMoreReferenceLinksHint')}</Text>
              {!moreRefLinksReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={styles.prefRow}>
                  <Text style={styles.prefLabel}>{t('settingsMoreReferenceLinksSwitch')}</Text>
                  <Switch
                    value={moreRefLinksVisible}
                    onValueChange={(v) => {
                      setMoreRefLinksVisible(v);
                      void saveMoreReferenceLinksVisible(v);
                    }}
                    trackColor={{ false: '#333', true: theme.green + '88' }}
                    thumbColor={moreRefLinksVisible ? theme.green : '#888'}
                  />
                </View>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsCacheSectionTitle')}</Text>
              <Text style={styles.prefHint}>{t('settingsCacheHint')}</Text>
              <Pressable
                onPress={onClearAllCaches}
                style={({ pressed }) => [styles.cacheClearBtn, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel={t('settingsCacheClearButton')}>
                <Text style={styles.cacheClearBtnText}>{t('settingsCacheClearButton')}</Text>
              </Pressable>
              {memoryCacheClearNotice ? (
                <Text
                  style={styles.cacheClearSuccess}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  {t('settingsCacheClearedBody')}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

      </ScrollView>
      <View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: floatingFooterLeft,
            width: floatingFooterWidth,
            bottom: tabBarPositionBottom(insets.bottom),
            borderRadius: TAB_BAR_FLOAT_RADIUS,
            overflow: 'hidden',
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          },
          Platform.OS === 'ios'
            ? {
                shadowColor: '#191F28',
                shadowOpacity: 0.08,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
              }
            : {
                shadowColor: '#191F28',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 14,
                elevation: 8,
              },
        ]}>
        <Pressable
          onPress={() => void Linking.openURL(DEVELOPER_LINKEDIN_URL)}
          style={({ pressed }) => [styles.settingsFooterPress, pressed && { opacity: 0.88 }]}
          accessibilityRole="link"
          accessibilityLabel={t('settingsDeveloperLinkedInA11y')}>
          <Image
            source={developerAvatar}
            style={styles.settingsFooterAvatar}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text style={styles.settingsFooterText} numberOfLines={1}>
            {t('settingsDeveloperFooterLine')}
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={quotesLimitPicker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setQuotesLimitPicker(null)}>
        <View style={styles.limitPickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQuotesLimitPicker(null)} />
          <View style={styles.limitPickerSheet}>
            <Text style={styles.limitPickerTitle}>
              {quotesLimitPicker === 'popular'
                ? t('settingsQuotesPopularCountLabel')
                : quotesLimitPicker === 'mcap'
                  ? t('settingsQuotesMcapCountLabel')
                  : quotesLimitPicker === 'coin'
                    ? t('settingsQuotesCoinCountLabel')
                    : ''}
            </Text>
            <ScrollView
              style={styles.limitPickerScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator>
              {quotesPickerOptions.map((n) => {
                const sel =
                  quotesLimitPicker === 'popular'
                    ? quotesListLimits.popularMax === n
                    : quotesLimitPicker === 'mcap'
                      ? quotesListLimits.mcapMax === n
                      : quotesListLimits.coinMax === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      setQuotesListLimits((prev) => {
                        const patch =
                          quotesLimitPicker === 'popular'
                            ? { popularMax: n }
                            : quotesLimitPicker === 'mcap'
                              ? { mcapMax: n }
                              : { coinMax: n };
                        const next = normalizeQuotesListLimits({ ...prev, ...patch });
                        void saveQuotesListLimits(next);
                        return next;
                      });
                      setQuotesLimitPicker(null);
                    }}
                    style={[styles.limitPickerOption, sel && styles.limitPickerOptionActive]}>
                    <Text style={[styles.limitPickerOptionText, sel && styles.limitPickerOptionTextActive]}>{n}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={accentPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAccentPickerOpen(false)}>
        <View style={styles.accentModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAccentPickerOpen(false)} />
          <View
            style={[
              styles.accentModalSheet,
              {
                width: accentPickerLayout.sheetW,
                maxHeight: accentPickerLayout.maxSheetH,
                paddingBottom: Math.max(insets.bottom, 8),
              },
            ]}>
            <Text style={styles.accentModalTitle}>{t('settingsAccentCustomModalTitle')}</Text>
            <Text style={styles.accentModalHint}>{t('settingsAccentPaletteHint')}</Text>
            <ScrollView
              style={[styles.accentPaletteScroll, { maxHeight: accentPickerLayout.paletteScrollMaxH }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator>
              <View
                style={[
                  styles.accentPaletteGrid,
                  {
                    width: accentPickerLayout.gridInnerW,
                    gap: accentPickerLayout.gap,
                  },
                ]}>
                {accentSwatchPalette.map((hex, swatchIndex) => {
                  const selected = normalizeHex(hex) === normalizeHex(accentPickerDraftHex);
                  const cell = accentPickerLayout.cell;
                  const badge = Math.max(10, Math.min(20, Math.floor(Number(cell) * 0.52)));
                  const iconSize = Math.max(7, Math.floor(badge * 0.42));
                  return (
                    <Pressable
                      key={`swatch-${swatchIndex}-${hex}`}
                      onPress={() => setAccentPickerDraftHex(hex)}
                      style={[
                        styles.accentSwatchCell,
                        {
                          width: cell,
                          height: cell,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={hex}>
                      <View style={styles.accentSwatchInner}>
                        <View style={[styles.accentSwatchFill, { backgroundColor: hex }]} />
                        {selected ? (
                          <View style={styles.accentSwatchSelectedOverlay} pointerEvents="none">
                            <View
                              style={[
                                styles.accentSwatchSelectedBadge,
                                {
                                  width: badge,
                                  height: badge,
                                  borderRadius: badge / 2,
                                },
                              ]}>
                              <FontAwesome name="check" size={iconSize} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.accentModalFooterActions}>
              <Pressable
                onPress={() => setAccentPickerOpen(false)}
                style={[styles.accentModalCancelBtn, styles.accentModalFooterBtnHalf]}
                accessibilityRole="button"
                accessibilityLabel={t('commonCancel')}>
                <Text style={styles.accentModalCancelBtnText}>{t('commonCancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void setCustomAccent(accentPickerDraftHex);
                  setAccentPickerOpen(false);
                }}
                style={[styles.accentModalApplyBtn, styles.accentModalFooterBtnHalf]}
                accessibilityRole="button"
                accessibilityLabel={t('settingsAccentApply')}>
                <Text style={styles.accentModalApplyBtnText}>{t('settingsAccentApply')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  return useIpadSidebar ? (
    <IpadSidebarScreen title={t('screenSettings')} backHref="/(tabs)/more">
      {screen}
    </IpadSidebarScreen>
  ) : (
    screen
  );
}
