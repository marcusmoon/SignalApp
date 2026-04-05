import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AppTheme } from '@/constants/theme';
import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';
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
import type { AccentPresetId } from '@/services/accentPreference';
import { ACCENT_PRESETS } from '@/services/accentPreference';
import { clearCalendarCache, CALENDAR_CACHE_TTL_MS } from '@/services/calendarCache';
import { clearConcallCache, CONCALL_CACHE_TTL_MS } from '@/services/concallCache';
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
  loadQuotesListLimits,
  normalizeQuotesListLimits,
  quotesListCountChoicesForField,
  saveQuotesListLimits,
  QUOTES_LIST_LIMIT_BOUNDS,
  QUOTES_LIST_LIMITS_DEFAULTS,
  type QuotesListLimits,
} from '@/services/quotesListLimitsPreference';
import { loadNotificationPrefs, saveNotificationPrefs } from '@/services/notificationPreferences';
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

type SettingsTab = 'youtube' | 'quotes' | 'notifications' | 'display' | 'calendar';

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

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
};

const ACCENT_SWATCH_ROWS: AccentPresetId[][] = [
  ['green', 'red', 'blue', 'yellow', 'orange', 'purple'],
  ['cyan', 'teal', 'pink', 'lime', 'indigo', 'rose'],
];

const LOCALE_ORDER: AppLocale[] = ['ko', 'en', 'ja'];
const LOCALE_LABEL: Record<AppLocale, MessageId> = {
  ko: 'localeNameKo',
  en: 'localeNameEn',
  ja: 'localeNameJa',
};

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scrollFlex: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingBottom: 32 },
    tabBar: {
      flexShrink: 0,
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 8,
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
      fontSize: SEGMENT_TAB_FONT_SIZE,
      lineHeight: SEGMENT_TAB_LINE_HEIGHT,
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    tabTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    lead: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: 21,
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
      fontSize: 13,
      fontWeight: '800',
      color: theme.textMuted,
      marginBottom: 6,
    },
    cardHint: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: 19,
    },
    prefRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      gap: 12,
    },
    prefLabel: { fontSize: 14, fontWeight: '600', color: theme.text, flex: 1 },
    section: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 8,
    },
    muted: { fontSize: 14, fontWeight: '500', color: theme.textMuted, marginBottom: 12 },
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
    handleText: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '600' },
    removeBtn: { padding: 8 },
    hint: { fontSize: 12, fontWeight: '500', color: theme.textDim, marginBottom: 8 },
    addRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center' },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      backgroundColor: '#12121A',
    },
    addBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.green,
    },
    addBtnText: { fontSize: 14, fontWeight: '800', color: '#0A0A0F' },
    resetBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#553333',
      backgroundColor: '#1A1212',
    },
    resetBtnText: { fontSize: 13, fontWeight: '700', color: '#E0A0A0' },
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
      fontSize: 11,
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
      fontSize: 11,
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
    displayAccentName: {
      textAlign: 'center',
      fontSize: 13,
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
    langSegmentActive: {
      backgroundColor: theme.green,
    },
    langSegmentText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textDim,
    },
    langSegmentTextActive: {
      color: '#0A0A0F',
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
      fontSize: 13,
      fontWeight: '700',
      color: theme.green,
      paddingRight: 8,
    },
    cacheOneLiner: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: 17,
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
    cacheClearBtnText: { fontSize: 13, fontWeight: '800', color: theme.green },
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
      fontSize: 12,
      fontWeight: '500',
      color: theme.textDim,
      lineHeight: 17,
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
      fontSize: 15,
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
      fontSize: 15,
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
      fontSize: 16,
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
      fontSize: 15,
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

export default function SettingsScreen() {
  const { theme, presetId, setPresetId } = useSignalTheme();
  const { t, locale, setLocale } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [tab, setTab] = useState<SettingsTab>('youtube');
  const [handles, setHandles] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [earningsOnly, setEarningsOnly] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  const [calendarScope, setCalendarScope] = useState<CalendarConcallScope>('mega');
  const [calendarScopeReady, setCalendarScopeReady] = useState(false);

  const [cachePrefs, setCachePrefs] = useState<CacheFeaturePrefs>({
    youtubeEnabled: true,
    concallEnabled: true,
    calendarEnabled: true,
    quotesEnabled: true,
  });

  const [quotesListLimits, setQuotesListLimits] = useState<QuotesListLimits>(() =>
    normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS),
  );
  const [quotesLimitsReady, setQuotesLimitsReady] = useState(false);
  const [quotesSegmentOrder, setQuotesSegmentOrder] =
    useState<QuoteSegmentKey[]>(DEFAULT_QUOTES_SEGMENT_ORDER);
  const [quotesSegmentOrderReady, setQuotesSegmentOrderReady] = useState(false);
  const [quotesLimitPicker, setQuotesLimitPicker] = useState<'popular' | 'mcap' | 'coin' | null>(null);

  const quotesPickerOptions = useMemo(() => {
    if (!quotesLimitPicker) return [];
    return quotesListCountChoicesForField(quotesLimitPicker);
  }, [quotesLimitPicker]);

  const reloadCachePrefs = useCallback(async () => {
    const p = await loadCacheFeaturePrefs();
    setCachePrefs(p);
  }, []);

  useEffect(() => {
    const raw = params.tab;
    const tabParam = Array.isArray(raw) ? raw[0] : raw;
    if (
      tabParam === 'youtube' ||
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
    setPrefsReady(true);
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

  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadPrefs();
      void reloadCalendarScope();
      void reloadCachePrefs();
      void reloadQuotesListLimits();
      void reloadQuotesSegmentOrder();
    }, [
      reload,
      reloadPrefs,
      reloadCalendarScope,
      reloadCachePrefs,
      reloadQuotesListLimits,
      reloadQuotesSegmentOrder,
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

  const cacheYoutubeMinutes = Math.round(YOUTUBE_CACHE_TTL_MS / 60000);
  const cacheConcallMinutes = Math.round(CONCALL_CACHE_TTL_MS / 60000);
  const cacheCalendarMinutes = Math.round(CALENDAR_CACHE_TTL_MS / 60000);
  const cacheQuotesSeconds = Math.round(QUOTES_CACHE_TTL_MS / 1000);

  const onClearMemoryCaches = () => {
    clearYoutubeCache();
    clearConcallCache();
    clearCalendarCache();
    clearQuotesCache();
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.tabBar}>
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
        contentContainerStyle={styles.scroll}
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
                    accessibilityLabel={`${h} 제거`}>
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
                </>
              )}
            </View>
          </>
        ) : null}

        {tab === 'display' ? (
          <>
            <Text style={styles.lead}>{t('settingsThemeLead')}</Text>

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
                {t('settingsDisplaySelectedTheme', { name: t(ACCENT_LABEL[presetId]) })}
              </Text>
            </View>

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
              <Text style={styles.displayCardKicker}>{t('settingsCacheSectionTitle')}</Text>
              <Text style={styles.cacheOneLiner}>
                {formatMessage(t('settingsCacheOneLiner'), {
                  yt: cacheYoutubeMinutes,
                  cc: cacheConcallMinutes,
                  cal: cacheCalendarMinutes,
                  qt: cacheQuotesSeconds,
                })}
              </Text>
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
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>{t('settingsCacheQuotesToggle')}</Text>
                <Switch
                  value={cachePrefs.quotesEnabled}
                  onValueChange={(v) => void onQuotesCacheEnabledChange(v)}
                  trackColor={{ false: '#333', true: theme.green + '88' }}
                  thumbColor={cachePrefs.quotesEnabled ? theme.green : '#888'}
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
    </SafeAreaView>
  );
}
