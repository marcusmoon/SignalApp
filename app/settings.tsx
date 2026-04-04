import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import type { AppTheme } from '@/constants/theme';
import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { AppLocale, MessageId } from '@/locales/messages';
import type { AccentPresetId } from '@/services/accentPreference';
import { ACCENT_PRESETS } from '@/services/accentPreference';
import { clearYoutubeCache } from '@/services/youtubeCache';
import {
  isValidYoutubeHandle,
  loadCurationHandles,
  normalizeYoutubeHandle,
  resetCurationToDefaults,
  saveCurationHandles,
} from '@/services/youtubeCurationList';
import { reconcileSelectedChannels } from '@/services/youtubeChannelSelection';
import { DEFAULT_US_WATCHLIST } from '@/services/finnhub';
import {
  isValidUsTicker,
  loadWatchlistSymbols,
  resetWatchlistToDefaults,
  saveWatchlistSymbols,
} from '@/services/quoteWatchlist';
import { loadNotificationPrefs, saveNotificationPrefs } from '@/services/notificationPreferences';

type SettingsTab = 'youtube' | 'quotes' | 'display' | 'notifications';

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
    scroll: { paddingHorizontal: 16, paddingBottom: 32 },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: '#12121A',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      marginBottom: 16,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBtnActive: {
      backgroundColor: theme.green,
    },
    tabText: {
      fontSize: 9,
      fontWeight: '800',
      color: theme.textDim,
    },
    tabTextActive: {
      color: '#0A0A0F',
    },
    lead: {
      fontSize: 13,
      color: theme.textDim,
      lineHeight: 20,
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
      fontSize: 12,
      fontWeight: '800',
      color: theme.textMuted,
      marginBottom: 6,
    },
    cardHint: {
      fontSize: 12,
      color: theme.textDim,
      lineHeight: 18,
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
    muted: { fontSize: 13, color: theme.textMuted, marginBottom: 12 },
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
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 8 },
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
      fontSize: 10,
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 1.2,
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
      fontSize: 10,
      fontWeight: '700',
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
      fontSize: 12,
      fontWeight: '700',
      color: theme.textDim,
    },
    langSegmentTextActive: {
      color: '#0A0A0F',
    },
  });
}

export default function SettingsScreen() {
  const { theme, presetId, setPresetId } = useSignalTheme();
  const { t, locale, setLocale } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<SettingsTab>('youtube');
  const [handles, setHandles] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  const [watchSymbols, setWatchSymbols] = useState<string[]>([]);
  const [watchDraft, setWatchDraft] = useState('');
  const [watchReady, setWatchReady] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [earningsOnly, setEarningsOnly] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    const raw = params.tab;
    const tabParam = Array.isArray(raw) ? raw[0] : raw;
    if (
      tabParam === 'youtube' ||
      tabParam === 'quotes' ||
      tabParam === 'display' ||
      tabParam === 'notifications'
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

  const reload = useCallback(async () => {
    const list = await loadCurationHandles();
    setHandles(list);
    setReady(true);
  }, []);

  const reloadWatch = useCallback(async () => {
    const list = await loadWatchlistSymbols();
    setWatchSymbols(list);
    setWatchReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadWatch();
      void reloadPrefs();
    }, [reload, reloadWatch, reloadPrefs]),
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

  const persistWatch = async (next: string[]) => {
    await saveWatchlistSymbols(next);
    setWatchSymbols(next);
  };

  const onAddWatch = async () => {
    const h = watchDraft.trim().toUpperCase().replace(/\s+/g, '');
    if (!h) {
      Alert.alert(t('alertTitleInputError'), t('alertEmptyTicker'));
      return;
    }
    if (!isValidUsTicker(h)) {
      Alert.alert(t('alertTitleFormatError'), t('alertTickerRule'));
      return;
    }
    if (watchSymbols.includes(h)) {
      Alert.alert(t('alertTitleDup'), t('alertDupTicker'));
      return;
    }
    setWatchDraft('');
    await persistWatch([...watchSymbols, h]);
  };

  const onRemoveWatch = async (ticker: string) => {
    await persistWatch(watchSymbols.filter((x) => x !== ticker));
  };

  const onResetWatchDefaults = () => {
    Alert.alert(
      t('alertResetWatchTitle'),
      t('alertResetWatchBody'),
      [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('alertReset'),
          style: 'destructive',
          onPress: async () => {
            const next = await resetWatchlistToDefaults();
            setWatchSymbols(next);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setTab('youtube')}
            style={[styles.tabBtn, tab === 'youtube' && styles.tabBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'youtube' }}>
            <Text style={[styles.tabText, tab === 'youtube' && styles.tabTextActive]}>{t('settingsTabYoutube')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('quotes')}
            style={[styles.tabBtn, tab === 'quotes' && styles.tabBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'quotes' }}>
            <Text style={[styles.tabText, tab === 'quotes' && styles.tabTextActive]}>{t('settingsTabQuotes')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('display')}
            style={[styles.tabBtn, tab === 'display' && styles.tabBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'display' }}>
            <Text style={[styles.tabText, tab === 'display' && styles.tabTextActive]}>{t('settingsTabDisplay')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('notifications')}
            style={[styles.tabBtn, tab === 'notifications' && styles.tabBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'notifications' }}>
            <Text style={[styles.tabText, tab === 'notifications' && styles.tabTextActive]}>
              {t('settingsTabNotifications')}
            </Text>
          </Pressable>
        </View>

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
            <Text style={styles.lead}>{t('settingsQuotesLead')}</Text>

            <Text style={styles.section}>{t('settingsQuotesSectionAdd')}</Text>
            <Text style={styles.hint}>{t('settingsQuotesHintTicker')}</Text>
            <View style={styles.addRow}>
              <TextInput
                value={watchDraft}
                onChangeText={setWatchDraft}
                placeholder={t('settingsQuotesPlaceholderTicker')}
                placeholderTextColor={theme.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                onSubmitEditing={() => void onAddWatch()}
                returnKeyType="done"
              />
              <Pressable onPress={() => void onAddWatch()} style={styles.addBtn} accessibilityRole="button">
                <Text style={styles.addBtnText}>{t('commonAdd')}</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('settingsQuotesDefaultWatchlist')}</Text>
              <Text style={styles.cardHint}>{DEFAULT_US_WATCHLIST.join(', ')}</Text>
            </View>

            <Text style={styles.section}>{t('settingsQuotesCurrentList', { count: watchSymbols.length })}</Text>
            {!watchReady ? (
              <Text style={styles.muted}>{t('commonLoading')}</Text>
            ) : (
              watchSymbols.map((sym) => (
                <View key={sym} style={styles.row}>
                  <Text style={styles.handleText} numberOfLines={1}>
                    {sym}
                  </Text>
                  <Pressable
                    onPress={() => void onRemoveWatch(sym)}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`${sym} 제거`}>
                    <FontAwesome name="trash" size={16} color="#C08080" />
                  </Pressable>
                </View>
              ))
            )}

            <Pressable onPress={onResetWatchDefaults} style={styles.resetBtn} accessibilityRole="button">
              <Text style={styles.resetBtnText}>{t('settingsQuotesReset')}</Text>
            </Pressable>
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
      </ScrollView>
    </SafeAreaView>
  );
}
