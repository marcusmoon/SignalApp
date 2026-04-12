import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import developerAvatar from '@/assets/images/developer-avatar.png';
import { DEVELOPER_LINKEDIN_URL } from '@/constants/developer';
import { NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import {
  DEFAULT_TAB_BAR_GLASS_LEVEL,
  DEFAULT_TAB_BAR_GLASS_PERCENT,
  TAB_BAR_GLASS_PARAMS,
  type TabBarGlassLevel,
} from '@/constants/tabBarGlass';
import {
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOAT_MARGIN_H,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { TabBarGlassSurface } from '@/components/TabBarGlassSurface';
import { TabBarGlassPreview } from '@/components/TabBarGlassPreview';
import { TabBarGlassSlider } from '@/components/TabBarGlassSlider';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatMessage, type AppLocale, type MessageId } from '@/locales/messages';
import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  loadQuotesSegmentOrder,
  saveQuotesSegmentOrder,
  type QuoteSegmentKey,
} from '@/services/quotesSegmentOrderPreference';
import type { AccentPresetId } from '@/services/accentPreference';
import { ACCENT_PRESETS, normalizeHex } from '@/services/accentPreference';
import type { FontSizePresetId } from '@/services/fontSizePreference';
import { clearCalendarCache, CALENDAR_CACHE_TTL_MS } from '@/services/calendarCache';
import { clearConcallCache, CONCALL_CACHE_TTL_MS } from '@/services/concallCache';
import { clearNewsCache, NEWS_CACHE_TTL_MS } from '@/services/newsCache';
import { clearQuotesCache, QUOTES_CACHE_TTL_MS } from '@/services/quotesCache';
import { clearYoutubeCache, YOUTUBE_CACHE_TTL_MS } from '@/services/youtubeCache';
import {
  isValidYoutubeHandle,
  loadCurationHandles,
  normalizeYoutubeHandle,
  resetCurationToDefaults,
  saveCurationHandles,
} from '@/services/youtubeCurationList';
import { reconcileSelectedChannels } from '@/services/youtubeChannelSelection';
import {
  loadCalendarConcallScope,
  saveCalendarConcallScope,
  type CalendarConcallScope,
} from '@/services/calendarConcallScopePreference';
import {
  loadCacheFeaturePrefs,
  saveCacheFeaturePrefs,
  type CacheFeaturePrefs,
} from '@/services/cacheFeaturePreferences';
import {
  loadLlmProvider,
  saveLlmProvider,
  type LlmProviderId,
} from '@/services/llmProviderPreference';
import { hasAnthropic, hasOpenAI } from '@/services/env';
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
  loadKoreaNewsExtraKeywords,
  normalizeKoreaNewsExtraKeywords,
  restoreKoreaNewsExtraKeywordsDefaults,
  saveKoreaNewsExtraKeywords,
} from '@/services/newsKoreaKeywordsPreference';
import { loadNewsSegmentOrder, saveNewsSegmentOrder } from '@/services/newsSegmentOrderPreference';
import { syncCalendarLocalReminders } from '@/services/calendarLocalReminders';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/services/notificationPreferences';
import {
  loadMoreReferenceLinksVisible,
  saveMoreReferenceLinksVisible,
} from '@/services/moreReferenceLinksPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { loadTabBarGlassLevel, saveTabBarGlassLevel } from '@/services/tabBarGlassPreference';
import {
  ACCENT_PALETTE_COLS,
  ACCENT_PALETTE_ROWS,
  buildRainbowKoreanAccentPalette,
} from '@/utils/accentSwatchPalette';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BACKGROUND,
  SEGMENT_TAB_BTN_PADDING_V,
  SEGMENT_TAB_BTN_RADIUS,
  SEGMENT_TAB_FONT_SIZE,
  SEGMENT_TAB_FONT_WEIGHT,
  SEGMENT_TAB_GAP,
  SEGMENT_TAB_LINE_HEIGHT,
  SEGMENT_TAB_OUTER_RADIUS,
  SEGMENT_TAB_PADDING,
} from '@/constants/segmentTabBar';

type SettingsTab = 'youtube' | 'news' | 'quotes' | 'notifications' | 'display' | 'calendar';

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

const NEWS_FEED_SEGMENT_LABEL: Record<NewsSegmentKey, MessageId> = {
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
};

/** 3 rows + gaps — 뉴스 글로벌/코인/한국 순서 */
const NEWS_SEGMENT_ORDER_ROW_GAP = 8;
const NEWS_SEGMENT_ORDER_LIST_HEIGHT = 54 * 3 + NEWS_SEGMENT_ORDER_ROW_GAP * 2 + 20;

function tabBarGlassLevelToPercent(lv: TabBarGlassLevel): number {
  return Math.round((lv / 4) * 100);
}

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

const FONT_SIZE_PRESET_ORDER: FontSizePresetId[] = ['compact', 'standard', 'comfortable'];
const FONT_SIZE_PRESET_LABEL: Record<FontSizePresetId, MessageId> = {
  compact: 'settingsFontSizeCompact',
  standard: 'settingsFontSizeStandard',
  comfortable: 'settingsFontSizeComfortable',
};

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scrollFlex: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
    tabBar: {
      flexShrink: 0,
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 6,
      backgroundColor: SEGMENT_TAB_BACKGROUND,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      gap: SEGMENT_TAB_GAP,
    },
    tabBtn: {
      flex: 1,
      minWidth: 0,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
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
      borderRadius: 10,
      backgroundColor: '#12121A',
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
      borderRadius: 8,
      backgroundColor: '#14141C',
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
      backgroundColor: '#12121A',
    },
    addBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.green,
    },
    addBtnText: { fontSize: sf(14), fontWeight: '800', color: '#0A0A0F' },
    resetBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#553333',
      backgroundColor: '#1A1212',
    },
    resetBtnText: { fontSize: sf(13), fontWeight: '700', color: '#E0A0A0' },
    displayCard: {
      marginBottom: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: '#0E0E14',
      padding: 16,
      overflow: 'hidden',
    },
    displayCardKicker: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    themePreviewShell: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: '#12121A',
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
      backgroundColor: 'rgba(255,255,255,0.2)',
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
      backgroundColor: 'rgba(255,255,255,0.06)',
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
      borderColor: 'rgba(255,255,255,0.45)',
    },
    themeSwatchFill: {
      flex: 1,
      borderRadius: 999,
    },
    themeSwatchCustomPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#14141C',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
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
      backgroundColor: 'rgba(0,0,0,0.52)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.45)',
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
      backgroundColor: theme.bg,
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
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentSwatchSelectedBadge: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    accentSwatchFill: {
      ...StyleSheet.absoluteFillObject,
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
      backgroundColor: '#14141C',
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
      color: '#0B0B10',
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
      backgroundColor: '#14141C',
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
      color: '#0A0A0F',
    },
    tabBarGlassPercent: {
      fontSize: sf(26),
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.5,
    },
    tabBarGlassPreviewKicker: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textDim,
      marginTop: 6,
      letterSpacing: 0.2,
    },
    megaCapListLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.06)',
    },
    megaCapListLinkText: {
      flex: 1,
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.green,
      paddingRight: 8,
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
      borderColor: theme.border,
      backgroundColor: '#14141C',
    },
    cacheClearBtnText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
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
    limitPickerTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: '#14141C',
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
      backgroundColor: '#14141C',
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
  });
}

/** 하단 플로팅 개발자 바 높이(탭바 캡슐과 비슷하게) */
const SETTINGS_DEV_FOOTER_INNER_MIN_HEIGHT = 52;

export default function SettingsScreen() {
  const {
    theme,
    presetId,
    setPresetId,
    customHex,
    setCustomAccent,
    fontSizePreset,
    setFontSizePreset,
    scaleFont,
  } = useSignalTheme();
  const { t, locale, setLocale } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [tab, setTab] = useState<SettingsTab>('news');
  const [handles, setHandles] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [earningsOnly, setEarningsOnly] = useState(false);
  const [localMacroCalendar, setLocalMacroCalendar] = useState(false);
  const [localWatchlistEarnings, setLocalWatchlistEarnings] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  const [calendarScope, setCalendarScope] = useState<CalendarConcallScope>('mega');
  const [calendarScopeReady, setCalendarScopeReady] = useState(false);

  const [cachePrefs, setCachePrefs] = useState<CacheFeaturePrefs>({
    youtubeEnabled: true,
    concallEnabled: true,
    calendarEnabled: true,
    quotesEnabled: true,
    newsEnabled: true,
  });

  const [quotesListLimits, setQuotesListLimits] = useState<QuotesListLimits>(() =>
    normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS),
  );
  const [quotesLimitsReady, setQuotesLimitsReady] = useState(false);
  const [quotesSegmentOrder, setQuotesSegmentOrder] =
    useState<QuoteSegmentKey[]>(DEFAULT_QUOTES_SEGMENT_ORDER);
  const [quotesSegmentOrderReady, setQuotesSegmentOrderReady] = useState(false);
  const [quotesLimitPicker, setQuotesLimitPicker] = useState<'popular' | 'mcap' | 'coin' | null>(null);

  const [koreaExtraKeywords, setKoreaExtraKeywords] = useState<string[]>([]);
  const [koreaKeywordDraft, setKoreaKeywordDraft] = useState('');
  const [koreaKeywordsReady, setKoreaKeywordsReady] = useState(false);

  const [newsSegmentOrder, setNewsSegmentOrder] = useState<NewsSegmentKey[]>([...NEWS_SEGMENT_ORDER]);
  const [newsSegmentOrderReady, setNewsSegmentOrderReady] = useState(false);

  const [tabBarGlassLevel, setTabBarGlassLevel] = useState<TabBarGlassLevel>(DEFAULT_TAB_BAR_GLASS_LEVEL);
  const [tabBarGlassReady, setTabBarGlassReady] = useState(false);
  const [tabBarGlassPercent, setTabBarGlassPercent] = useState(() => DEFAULT_TAB_BAR_GLASS_PERCENT);

  const [llmProvider, setLlmProvider] = useState<LlmProviderId>('none');
  const [llmProviderReady, setLlmProviderReady] = useState(false);

  const [moreRefLinksVisible, setMoreRefLinksVisible] = useState(true);
  const [moreRefLinksReady, setMoreRefLinksReady] = useState(false);

  const claudeAvailable = hasAnthropic();
  const openaiAvailable = hasOpenAI();

  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [accentPickerDraftHex, setAccentPickerDraftHex] = useState(customHex);

  const openAccentPicker = useCallback(() => {
    setAccentPickerDraftHex(customHex);
    setAccentPickerOpen(true);
  }, [customHex]);

  const { width: winW, height: winH } = useWindowDimensions();
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

  const glassParams = TAB_BAR_GLASS_PARAMS[tabBarGlassLevel];

  const scrollContentBottomPad = useMemo(
    () =>
      32 +
      insets.bottom +
      TAB_BAR_FLOAT_MARGIN_BOTTOM +
      SETTINGS_DEV_FOOTER_INNER_MIN_HEIGHT +
      12,
    [insets.bottom],
  );

  const reloadCachePrefs = useCallback(async () => {
    const p = await loadCacheFeaturePrefs();
    setCachePrefs(p);
  }, []);

  useEffect(() => {
    const raw = params.tab;
    const tabParam = Array.isArray(raw) ? raw[0] : raw;
    if (
      tabParam === 'youtube' ||
      tabParam === 'news' ||
      tabParam === 'quotes' ||
      tabParam === 'display' ||
      tabParam === 'notifications' ||
      tabParam === 'calendar'
    ) {
      setTab(tabParam);
    }
  }, [params.tab]);

  const reloadPrefs = useCallback(async () => {
    const p = await loadNotificationPrefs();
    setPushEnabled(p.pushEnabled);
    setEarningsOnly(p.earningsOnly);
    setLocalMacroCalendar(p.localMacroCalendar);
    setLocalWatchlistEarnings(p.localWatchlistEarnings);
    setPrefsReady(true);
  }, []);

  const syncLocalCalendarNotifications = useCallback(async (prefs?: NotificationPrefs) => {
    const p = prefs ?? (await loadNotificationPrefs());
    const watch = await loadWatchlistSymbols();
    await syncCalendarLocalReminders(p, watch);
  }, []);

  const reloadCalendarScope = useCallback(async () => {
    const v = await loadCalendarConcallScope();
    setCalendarScope(v);
    setCalendarScopeReady(true);
  }, []);

  const reload = useCallback(async () => {
    const list = await loadCurationHandles();
    setHandles(list);
    setReady(true);
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

  const reloadKoreaKeywords = useCallback(async () => {
    const k = await loadKoreaNewsExtraKeywords();
    setKoreaExtraKeywords(k);
    setKoreaKeywordsReady(true);
  }, []);

  const reloadNewsSegmentOrder = useCallback(async () => {
    const o = await loadNewsSegmentOrder();
    setNewsSegmentOrder(o);
    setNewsSegmentOrderReady(true);
  }, []);

  const reloadTabBarGlassLevel = useCallback(async () => {
    const v = await loadTabBarGlassLevel();
    setTabBarGlassLevel(v);
    setTabBarGlassPercent(tabBarGlassLevelToPercent(v));
    setTabBarGlassReady(true);
  }, []);

  const reloadLlmProvider = useCallback(async () => {
    const v = await loadLlmProvider();
    let resolved = v;
    if (v === 'claude' && !claudeAvailable) resolved = 'none';
    if (v === 'openai' && !openaiAvailable) resolved = 'none';
    if (resolved !== v) {
      await saveLlmProvider(resolved);
    }
    setLlmProvider(resolved);
    setLlmProviderReady(true);
  }, [claudeAvailable, openaiAvailable]);

  const reloadMoreReferenceLinksPref = useCallback(async () => {
    const v = await loadMoreReferenceLinksVisible();
    setMoreRefLinksVisible(v);
    setMoreRefLinksReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadPrefs();
      void reloadCalendarScope();
      void reloadCachePrefs();
      void reloadQuotesListLimits();
      void reloadQuotesSegmentOrder();
      void reloadKoreaKeywords();
      void reloadNewsSegmentOrder();
      void reloadTabBarGlassLevel();
      void reloadLlmProvider();
      void reloadMoreReferenceLinksPref();
    }, [
      reload,
      reloadPrefs,
      reloadCalendarScope,
      reloadCachePrefs,
      reloadQuotesListLimits,
      reloadQuotesSegmentOrder,
      reloadKoreaKeywords,
      reloadNewsSegmentOrder,
      reloadTabBarGlassLevel,
      reloadLlmProvider,
      reloadMoreReferenceLinksPref,
    ]),
  );

  const persist = async (next: string[]) => {
    await saveCurationHandles(next);
    await reconcileSelectedChannels(next);
    clearYoutubeCache();
    setHandles(next);
  };

  const onAdd = async () => {
    const h = normalizeYoutubeHandle(draft);
    if (!h) {
      Alert.alert(t('alertTitleInputError'), t('alertEmptyHandle'));
      return;
    }
    if (!isValidYoutubeHandle(h)) {
      Alert.alert(t('alertTitleFormatError'), t('alertYoutubeHandleRule'));
      return;
    }
    if (handles.includes(h)) {
      Alert.alert(t('alertTitleDup'), t('alertDupHandle'));
      return;
    }
    setDraft('');
    await persist([...handles, h]);
  };

  const onRemove = async (handle: string) => {
    if (handles.length <= 1) {
      Alert.alert(t('alertTitleMinOne'), t('alertMinChannel'));
      return;
    }
    await persist(handles.filter((x) => x !== handle));
  };

  const onResetDefaults = () => {
    Alert.alert(
      t('alertResetCurationTitle'),
      t('alertResetCurationBody'),
      [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('alertReset'),
          style: 'destructive',
          onPress: async () => {
            const next = await resetCurationToDefaults();
            await reconcileSelectedChannels(next);
            clearYoutubeCache();
            setHandles(next);
          },
        },
      ],
    );
  };

  const onAddKoreaKeyword = async () => {
    const normalized = normalizeKoreaNewsExtraKeywords([koreaKeywordDraft]);
    if (normalized.length === 0) {
      Alert.alert(t('alertTitleInputError'), t('alertEmptyKoreaKeyword'));
      return;
    }
    const word = normalized[0];
    if (koreaExtraKeywords.some((x) => x.toLowerCase() === word.toLowerCase())) {
      Alert.alert(t('alertTitleDup'), t('alertDupKoreaKeyword'));
      return;
    }
    setKoreaKeywordDraft('');
    const next = [...koreaExtraKeywords, word];
    await saveKoreaNewsExtraKeywords(next);
    setKoreaExtraKeywords(next);
  };

  const onRemoveKoreaKeyword = async (word: string) => {
    const next = koreaExtraKeywords.filter((x) => x !== word);
    await saveKoreaNewsExtraKeywords(next);
    setKoreaExtraKeywords(next);
  };

  const onKoreaKeywordsClearAll = () => {
    Alert.alert(
      t('settingsNewsKoreaKeywordsReset'),
      t('settingsNewsKoreaKeywordsResetConfirmBody'),
      [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('alertReset'),
          style: 'destructive',
          onPress: async () => {
            await saveKoreaNewsExtraKeywords([]);
            setKoreaExtraKeywords([]);
          },
        },
      ],
    );
  };

  const onRestoreKoreaDefaults = () => {
    Alert.alert(
      t('settingsNewsKoreaKeywordsRestoreDefaults'),
      t('settingsNewsKoreaKeywordsRestoreConfirmBody'),
      [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('settingsNewsKoreaKeywordsRestoreDefaults'),
          onPress: async () => {
            await restoreKoreaNewsExtraKeywordsDefaults();
            const k = await loadKoreaNewsExtraKeywords();
            setKoreaExtraKeywords(k);
          },
        },
      ],
    );
  };

  const cacheYoutubeMinutes = Math.round(YOUTUBE_CACHE_TTL_MS / 60000);
  const cacheConcallMinutes = Math.round(CONCALL_CACHE_TTL_MS / 60000);
  const cacheCalendarMinutes = Math.round(CALENDAR_CACHE_TTL_MS / 60000);
  const cacheQuotesSeconds = Math.round(QUOTES_CACHE_TTL_MS / 1000);
  const cacheNewsMinutes = Math.round(NEWS_CACHE_TTL_MS / 60000);

  const onClearMemoryCaches = () => {
    clearYoutubeCache();
    clearConcallCache();
    clearCalendarCache();
    clearQuotesCache();
    clearNewsCache();
    Alert.alert(t('settingsCacheClearedTitle'), t('settingsCacheClearedBody'));
  };

  const onYoutubeCacheEnabledChange = async (v: boolean) => {
    setCachePrefs((prev) => ({ ...prev, youtubeEnabled: v }));
    await saveCacheFeaturePrefs({ youtubeEnabled: v });
    if (!v) clearYoutubeCache();
  };

  const onConcallCacheEnabledChange = async (v: boolean) => {
    setCachePrefs((prev) => ({ ...prev, concallEnabled: v }));
    await saveCacheFeaturePrefs({ concallEnabled: v });
    if (!v) clearConcallCache();
  };

  const onCalendarCacheEnabledChange = async (v: boolean) => {
    setCachePrefs((prev) => ({ ...prev, calendarEnabled: v }));
    await saveCacheFeaturePrefs({ calendarEnabled: v });
    if (!v) clearCalendarCache();
  };

  const onQuotesCacheEnabledChange = async (v: boolean) => {
    setCachePrefs((prev) => ({ ...prev, quotesEnabled: v }));
    await saveCacheFeaturePrefs({ quotesEnabled: v });
    if (!v) clearQuotesCache();
  };

  const onNewsCacheEnabledChange = async (v: boolean) => {
    setCachePrefs((prev) => ({ ...prev, newsEnabled: v }));
    await saveCacheFeaturePrefs({ newsEnabled: v });
    if (!v) clearNewsCache();
  };

  return (
    /** 상단 edge 없음 — 스택 헤더가 이미 안전 영역을 처리해 `edges.top`을 쓰면 헤더 아래 빈 여백이 커짐 */
    <SafeAreaView style={styles.safe} edges={[]}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setTab('news')}
          style={[styles.tabBtn, tab === 'news' && styles.tabBtnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'news' }}>
          <Text
            style={[styles.tabText, tab === 'news' && styles.tabTextActive]}
            numberOfLines={1}>
            {t('settingsTabNews')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('youtube')}
          style={[styles.tabBtn, tab === 'youtube' && styles.tabBtnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'youtube' }}>
          <Text
            style={[styles.tabText, tab === 'youtube' && styles.tabTextActive]}
            numberOfLines={1}>
            {t('settingsTabYoutube')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('quotes')}
          style={[styles.tabBtn, tab === 'quotes' && styles.tabBtnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'quotes' }}>
          <Text
            style={[styles.tabText, tab === 'quotes' && styles.tabTextActive]}
            numberOfLines={1}>
            {t('settingsTabQuotes')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('calendar')}
          style={[styles.tabBtn, tab === 'calendar' && styles.tabBtnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'calendar' }}>
          <Text
            style={[styles.tabText, tab === 'calendar' && styles.tabTextActive]}
            numberOfLines={1}>
            {t('settingsTabCalendar')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('display')}
          style={[styles.tabBtn, tab === 'display' && styles.tabBtnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'display' }}>
          <Text
            style={[styles.tabText, tab === 'display' && styles.tabTextActive]}
            numberOfLines={1}>
            {t('settingsTabDisplay')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('notifications')}
          style={[styles.tabBtn, tab === 'notifications' && styles.tabBtnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'notifications' }}>
          <Text
            style={[styles.tabText, tab === 'notifications' && styles.tabTextActive]}
            numberOfLines={1}>
            {t('settingsTabNotifications')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollContentBottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {tab === 'youtube' ? (
          <>
            <Text style={styles.lead}>{t('settingsYoutubeLead')}</Text>

            <Text style={styles.section}>{t('settingsYoutubeSectionAdd')}</Text>
            <Text style={styles.hint}>{t('settingsYoutubeHintHandle')}</Text>
            <View style={styles.addRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('settingsYoutubePlaceholderHandle')}
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                onSubmitEditing={() => void onAdd()}
                returnKeyType="done"
              />
              <Pressable onPress={() => void onAdd()} style={styles.addBtn} accessibilityRole="button">
                <Text style={styles.addBtnText}>{t('commonAdd')}</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('settingsYoutubeDefaultCuration')}</Text>
              <Text style={styles.cardHint}>{DEFAULT_YOUTUBE_CHANNEL_HANDLES.join(', ')}</Text>
            </View>

            <Text style={styles.section}>{t('settingsYoutubeCurrentList', { count: handles.length })}</Text>
            {!ready ? (
              <Text style={styles.muted}>{t('commonLoading')}</Text>
            ) : (
              handles.map((h) => (
                <View key={h} style={styles.row}>
                  <Text style={styles.handleText} numberOfLines={1}>
                    @{h}
                  </Text>
                  <Pressable
                    onPress={() => void onRemove(h)}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('settingsYoutubeRemoveHandleA11y', { handle: `@${h}` })}>
                    <FontAwesome name="trash" size={16} color="#C08080" />
                  </Pressable>
                </View>
              ))
            )}

            <Pressable onPress={onResetDefaults} style={styles.resetBtn} accessibilityRole="button">
              <Text style={styles.resetBtnText}>{t('settingsYoutubeReset')}</Text>
            </Pressable>
          </>
        ) : null}

        {tab === 'quotes' ? (
          <>
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
              <Text style={styles.displayCardKicker}>{t('settingsNewsKoreaKeywordsKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsNewsKoreaKeywordsLead')}</Text>
              <Text style={styles.hint}>{t('settingsNewsKoreaKeywordsHint')}</Text>
              <View style={styles.addRow}>
                <TextInput
                  value={koreaKeywordDraft}
                  onChangeText={setKoreaKeywordDraft}
                  placeholder={t('settingsNewsKoreaKeywordsPlaceholder')}
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                  autoCorrect
                  style={styles.input}
                  onSubmitEditing={() => void onAddKoreaKeyword()}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={() => void onAddKoreaKeyword()}
                  style={styles.addBtn}
                  accessibilityRole="button">
                  <Text style={styles.addBtnText}>{t('commonAdd')}</Text>
                </Pressable>
              </View>
              {!koreaKeywordsReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                koreaExtraKeywords.map((kw) => (
                  <View key={kw} style={styles.row}>
                    <Text style={styles.handleText} numberOfLines={2}>
                      {kw}
                    </Text>
                    <Pressable
                      onPress={() => void onRemoveKoreaKeyword(kw)}
                      style={styles.removeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={kw}>
                      <FontAwesome name="trash" size={16} color="#C08080" />
                    </Pressable>
                  </View>
                ))
              )}
              {koreaKeywordsReady ? (
                <>
                  <Pressable
                    onPress={onRestoreKoreaDefaults}
                    style={({ pressed }) => [
                      styles.cacheClearBtn,
                      { marginTop: 8 },
                      pressed && { opacity: 0.88 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('settingsNewsKoreaKeywordsRestoreDefaults')}>
                    <Text style={styles.cacheClearBtnText}>{t('settingsNewsKoreaKeywordsRestoreDefaults')}</Text>
                  </Pressable>
                  {koreaExtraKeywords.length > 0 ? (
                    <Pressable
                      onPress={onKoreaKeywordsClearAll}
                      style={[styles.resetBtn, { marginTop: 8 }]}
                      accessibilityRole="button">
                      <Text style={styles.resetBtnText}>{t('settingsNewsKoreaKeywordsReset')}</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
          </>
        ) : null}

        {tab === 'notifications' ? (
          <>
            <Text style={styles.lead}>{t('settingsNotificationsLead')}</Text>
            <View style={styles.card}>
              {!prefsReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <View style={styles.prefRow}>
                    <Text style={styles.prefLabel}>{t('settingsPushEnabled')}</Text>
                    <Switch
                      value={pushEnabled}
                      onValueChange={async (v) => {
                        setPushEnabled(v);
                        await saveNotificationPrefs({ pushEnabled: v });
                      }}
                      trackColor={{ false: '#333', true: theme.green + '88' }}
                      thumbColor={pushEnabled ? theme.green : '#888'}
                    />
                  </View>
                  <View style={styles.prefRow}>
                    <Text style={styles.prefLabel}>{t('settingsEarningsOnly')}</Text>
                    <Switch
                      value={earningsOnly}
                      onValueChange={async (v) => {
                        setEarningsOnly(v);
                        await saveNotificationPrefs({ earningsOnly: v });
                      }}
                      trackColor={{ false: '#333', true: theme.green + '88' }}
                      thumbColor={earningsOnly ? theme.green : '#888'}
                    />
                  </View>
                  <View style={styles.prefBlock}>
                    <View style={styles.prefRow}>
                      <Text style={styles.prefLabel}>{t('settingsLocalMacroCalendar')}</Text>
                      <Switch
                        value={localMacroCalendar}
                        onValueChange={async (v) => {
                          setLocalMacroCalendar(v);
                          await saveNotificationPrefs({ localMacroCalendar: v });
                          await syncLocalCalendarNotifications({
                            pushEnabled,
                            earningsOnly,
                            localMacroCalendar: v,
                            localWatchlistEarnings,
                          });
                        }}
                        trackColor={{ false: '#333', true: theme.green + '88' }}
                        thumbColor={localMacroCalendar ? theme.green : '#888'}
                      />
                    </View>
                    <Text style={styles.prefHint}>{t('settingsLocalMacroCalendarHint')}</Text>
                  </View>
                  <View style={styles.prefBlock}>
                    <View style={styles.prefRow}>
                      <Text style={styles.prefLabel}>{t('settingsLocalWatchlistEarnings')}</Text>
                      <Switch
                        value={localWatchlistEarnings}
                        onValueChange={async (v) => {
                          setLocalWatchlistEarnings(v);
                          await saveNotificationPrefs({ localWatchlistEarnings: v });
                          await syncLocalCalendarNotifications({
                            pushEnabled,
                            earningsOnly,
                            localMacroCalendar,
                            localWatchlistEarnings: v,
                          });
                        }}
                        trackColor={{ false: '#333', true: theme.green + '88' }}
                        thumbColor={localWatchlistEarnings ? theme.green : '#888'}
                      />
                    </View>
                    <Text style={styles.prefHint}>{t('settingsLocalWatchlistEarningsHint')}</Text>
                  </View>
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
                      ]}>
                      {t(FONT_SIZE_PRESET_LABEL[id])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsThemeAccentSection')}</Text>
              <View style={styles.themePreviewShell}>
                <Text style={styles.themePreviewLabel}>{t('settingsDisplayPreviewLabel')}</Text>
                <View style={[styles.themePreviewBar, { backgroundColor: theme.green }]} />
                <View style={styles.themePreviewMockRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.themePreviewMockDot} />
                  ))}
                </View>
                <View style={styles.themePreviewMockTabs}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[styles.themePreviewMockTab, i === 0 && styles.themePreviewMockTabActive]}
                    />
                  ))}
                </View>
              </View>
              {ACCENT_SWATCH_ROWS.map((rowIds, rowIndex) => (
                <View
                  key={rowIds.join('-')}
                  style={[
                    styles.themeSwatchRow,
                    rowIndex === ACCENT_SWATCH_ROWS.length - 1 && styles.themeSwatchRowLast,
                  ]}>
                  {rowIds.map((id) => {
                    if (id === 'custom') {
                      const isCustom = presetId === 'custom';
                      return (
                        <Pressable
                          key="custom"
                          onPress={openAccentPicker}
                          style={[
                            styles.themeSwatchOuter,
                            isCustom && styles.themeSwatchOuterActive,
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isCustom }}
                          accessibilityLabel={t(ACCENT_LABEL.custom)}>
                          {isCustom ? (
                            <View
                              style={[
                                styles.themeSwatchFill,
                                { backgroundColor: customHex, overflow: 'hidden' },
                              ]}>
                              <View
                                style={styles.themeSwatchCustomBadgeOverlay}
                                pointerEvents="none">
                                <View style={styles.themeSwatchCustomBadge}>
                                  <FontAwesome name="paint-brush" size={11} color="#FFFFFF" />
                                </View>
                              </View>
                            </View>
                          ) : (
                            <View style={[styles.themeSwatchFill, styles.themeSwatchCustomPlaceholder]}>
                              <FontAwesome name="paint-brush" size={16} color={theme.textMuted} />
                            </View>
                          )}
                        </Pressable>
                      );
                    }
                    const p = ACCENT_PRESETS.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => void setPresetId(p.id)}
                        style={[
                          styles.themeSwatchOuter,
                          presetId === p.id && styles.themeSwatchOuterActive,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: presetId === p.id }}
                        accessibilityLabel={t(ACCENT_LABEL[p.id])}>
                        <View style={[styles.themeSwatchFill, { backgroundColor: p.accent }]} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <Text style={styles.displayAccentName}>
                {t('settingsDisplaySelectedTheme', {
                  name:
                    presetId === 'custom' ? t('accentCustom') : t(ACCENT_LABEL[presetId]),
                })}
              </Text>
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
              <Text style={styles.displayCardKicker}>{t('settingsTabBarGlassKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsTabBarGlassHint')}</Text>
              {!tabBarGlassReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <Text style={styles.tabBarGlassPercent} accessibilityLiveRegion="polite">
                    {tabBarGlassPercent}%
                  </Text>
                  <TabBarGlassSlider
                    level={tabBarGlassLevel}
                    accentColor={theme.green}
                    accessibilityLabel={formatMessage(t('settingsTabBarGlassA11y'), {
                      percent: tabBarGlassPercent,
                    })}
                    onPreviewChange={setTabBarGlassPercent}
                    onCommit={(lv) => {
                      setTabBarGlassLevel(lv);
                      void saveTabBarGlassLevel(lv);
                    }}
                  />
                  <Text style={styles.tabBarGlassPreviewKicker}>
                    {t('settingsTabBarGlassPreviewKicker')}
                  </Text>
                  <TabBarGlassPreview percent={tabBarGlassPercent} />
                </>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsLlmProviderKicker')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsLlmProviderHint')}</Text>
              {!llmProviderReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <>
                  <View style={styles.langSegmentedTrack}>
                    <Pressable
                      onPress={() => {
                        setLlmProvider('none');
                        void saveLlmProvider('none');
                      }}
                      style={[styles.langSegment, llmProvider === 'none' && styles.langSegmentActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: llmProvider === 'none' }}
                      accessibilityLabel={t('settingsLlmProviderNone')}>
                      <Text
                        style={[
                          styles.langSegmentText,
                          llmProvider === 'none' && styles.langSegmentTextActive,
                        ]}>
                        {t('settingsLlmProviderNone')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setLlmProvider('claude');
                        void saveLlmProvider('claude');
                      }}
                      disabled={!claudeAvailable}
                      style={[
                        styles.langSegment,
                        !claudeAvailable && styles.langSegmentDisabled,
                        llmProvider === 'claude' && claudeAvailable && styles.langSegmentActive,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: llmProvider === 'claude', disabled: !claudeAvailable }}
                      accessibilityLabel={t('settingsLlmProviderClaude')}>
                      <Text
                        style={[
                          styles.langSegmentText,
                          llmProvider === 'claude' && claudeAvailable && styles.langSegmentTextActive,
                        ]}>
                        {t('settingsLlmProviderClaude')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setLlmProvider('openai');
                        void saveLlmProvider('openai');
                      }}
                      disabled={!openaiAvailable}
                      style={[
                        styles.langSegment,
                        !openaiAvailable && styles.langSegmentDisabled,
                        llmProvider === 'openai' && openaiAvailable && styles.langSegmentActive,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: llmProvider === 'openai', disabled: !openaiAvailable }}
                      accessibilityLabel={t('settingsLlmProviderOpenai')}>
                      <Text
                        style={[
                          styles.langSegmentText,
                          llmProvider === 'openai' && openaiAvailable && styles.langSegmentTextActive,
                        ]}>
                        {t('settingsLlmProviderOpenai')}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsCacheSectionTitle')}</Text>
              <Text style={styles.cacheOneLiner}>
                {formatMessage(t('settingsCacheOneLiner'), {
                  yt: cacheYoutubeMinutes,
                  cc: cacheConcallMinutes,
                  cal: cacheCalendarMinutes,
                  qt: cacheQuotesSeconds,
                  news: cacheNewsMinutes,
                })}
              </Text>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('settingsCacheNewsToggle')}</Text>
                <Switch
                  value={cachePrefs.newsEnabled}
                  onValueChange={(v) => void onNewsCacheEnabledChange(v)}
                  trackColor={{ false: '#333', true: theme.green + '88' }}
                  thumbColor={cachePrefs.newsEnabled ? theme.green : '#888'}
                />
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('settingsCacheYoutubeToggle')}</Text>
                <Switch
                  value={cachePrefs.youtubeEnabled}
                  onValueChange={(v) => void onYoutubeCacheEnabledChange(v)}
                  trackColor={{ false: '#333', true: theme.green + '88' }}
                  thumbColor={cachePrefs.youtubeEnabled ? theme.green : '#888'}
                />
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('settingsCacheQuotesToggle')}</Text>
                <Switch
                  value={cachePrefs.quotesEnabled}
                  onValueChange={(v) => void onQuotesCacheEnabledChange(v)}
                  trackColor={{ false: '#333', true: theme.green + '88' }}
                  thumbColor={cachePrefs.quotesEnabled ? theme.green : '#888'}
                />
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('settingsCacheConcallToggle')}</Text>
                <Switch
                  value={cachePrefs.concallEnabled}
                  onValueChange={(v) => void onConcallCacheEnabledChange(v)}
                  trackColor={{ false: '#333', true: theme.green + '88' }}
                  thumbColor={cachePrefs.concallEnabled ? theme.green : '#888'}
                />
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('settingsCacheCalendarToggle')}</Text>
                <Switch
                  value={cachePrefs.calendarEnabled}
                  onValueChange={(v) => void onCalendarCacheEnabledChange(v)}
                  trackColor={{ false: '#333', true: theme.green + '88' }}
                  thumbColor={cachePrefs.calendarEnabled ? theme.green : '#888'}
                />
              </View>
              <Pressable
                onPress={onClearMemoryCaches}
                style={({ pressed }) => [styles.cacheClearBtn, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel={t('settingsCacheClearButton')}>
                <Text style={styles.cacheClearBtnText}>{t('settingsCacheClearButton')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {tab === 'calendar' ? (
          <>
            <Text style={styles.lead}>{t('settingsCalendarTabLead')}</Text>
            <View style={styles.displayCard}>
              <Text style={styles.displayCardKicker}>{t('settingsCalendarScopeTitle')}</Text>
              <Text style={styles.quotesCardHint}>{t('settingsCalendarScopeLead')}</Text>
              {!calendarScopeReady ? (
                <Text style={styles.muted}>{t('commonLoading')}</Text>
              ) : (
                <View style={styles.langSegmentedTrack}>
                  <Pressable
                    onPress={() => {
                      setCalendarScope('mega');
                      void saveCalendarConcallScope('mega');
                    }}
                    style={[styles.langSegment, calendarScope === 'mega' && styles.langSegmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: calendarScope === 'mega' }}
                    accessibilityLabel={t('settingsScopeMega')}>
                    <Text
                      style={[styles.langSegmentText, calendarScope === 'mega' && styles.langSegmentTextActive]}>
                      {t('settingsScopeMega')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setCalendarScope('watch');
                      void saveCalendarConcallScope('watch');
                    }}
                    style={[styles.langSegment, calendarScope === 'watch' && styles.langSegmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: calendarScope === 'watch' }}
                    accessibilityLabel={t('settingsScopeWatch')}>
                    <Text
                      style={[styles.langSegmentText, calendarScope === 'watch' && styles.langSegmentTextActive]}>
                      {t('settingsScopeWatch')}
                    </Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={() => router.push('/mega-cap-list')}
                style={({ pressed }) => [styles.megaCapListLink, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={t('settingsMegaCapListLink')}>
                <Text style={styles.megaCapListLinkText}>{t('settingsMegaCapListLink')}</Text>
                <FontAwesome name="chevron-right" size={14} color={theme.green} />
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: TAB_BAR_FLOAT_MARGIN_H,
            right: TAB_BAR_FLOAT_MARGIN_H,
            bottom: insets.bottom + TAB_BAR_FLOAT_MARGIN_BOTTOM,
            borderRadius: TAB_BAR_FLOAT_RADIUS,
            overflow: 'hidden',
          },
          Platform.OS === 'ios'
            ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } }
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: glassParams.android.shadowOpacity,
                shadowRadius: glassParams.android.shadowRadius,
                elevation: glassParams.android.elevation,
              },
        ]}>
        <TabBarGlassSurface level={tabBarGlassLevel} style={StyleSheet.absoluteFill} />
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
}
