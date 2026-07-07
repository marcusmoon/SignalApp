import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IpadSidebarScreen } from '@/components/layout/IpadSidebarScreen';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { HOME_DIGEST_CATEGORIES, NEWS_ISSUES_CATEGORY_ORDER, type NewsIssuesCategory } from '@/constants/ipadHomeNav';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_HEADER_CONTENT_GAP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { useSignalDatePickerSheet } from '@/hooks/useSignalDatePickerSheet';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import type { SignalApiNewsDigestItem } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { toYmd, utcRangeForLocalYmd } from '@/utils/date';

function parseCategory(value: unknown): NewsIssuesCategory {
  const raw = String(Array.isArray(value) ? value[0] : value || '').trim();
  if (raw === 'all') return 'all';
  return HOME_DIGEST_CATEGORIES.includes(raw as (typeof HOME_DIGEST_CATEGORIES)[number])
    ? (raw as (typeof HOME_DIGEST_CATEGORIES)[number])
    : 'all';
}

function parseDateParam(value: unknown): string {
  const raw = String(Array.isArray(value) ? value[0] : value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toYmd(new Date());
}

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function shiftYmd(ymd: string, days: number): string {
  const d = dateFromYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function formatDateLabel(ymd: string, locale: 'ko' | 'en' | 'ja'): string {
  const tag = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  try {
    return new Intl.DateTimeFormat(tag, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(dateFromYmd(ymd));
  } catch {
    return ymd;
  }
}

function sortDigests(rows: SignalApiNewsDigestItem[]): SignalApiNewsDigestItem[] {
  return [...rows].sort(
    (a, b) =>
      String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
      (b.count - a.count),
  );
}

type NewsIssuesContentProps = {
  embedded?: boolean;
  initialCategory?: NewsIssuesCategory;
  initialDate?: string;
  initialDigestId?: string | null;
  onBack?: () => void;
};

export function NewsIssuesContent({
  embedded = false,
  initialCategory = 'all',
  initialDate = toYmd(new Date()),
  initialDigestId = null,
  onBack,
}: NewsIssuesContentProps) {
  const { useTwoPane } = useResponsiveLayout();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const todayYmd = useRollingLocalYmd();
  const isWide = embedded || useTwoPane;
  const [category, setCategory] = useState<NewsIssuesCategory>(initialCategory);
  const [selectedYmd, setSelectedYmd] = useState(initialDate);
  const [items, setItems] = useState<SignalApiNewsDigestItem[]>([]);
  const itemsRef = useRef<SignalApiNewsDigestItem[]>([]);
  itemsRef.current = items;
  const [expandedId, setExpandedId] = useState<string | null>(initialDigestId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ref: scrollRef } = useScrollToTopOnChange([category, selectedYmd], {
    resyncDeps: [items],
  });

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSelectedYmd(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setExpandedId(initialDigestId);
  }, [initialDigestId]);

  const { openDatePicker, datePickerSheet } = useSignalDatePickerSheet({
    selectedYmd,
    todayYmd,
    onSelectYmd: setSelectedYmd,
  });

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setItems([]);
      setError(t('errorSignalApiShort'));
      setLoading(false);
      return;
    }
    const hadItems = itemsRef.current.length > 0;
    if (!hadItems) setLoading(true);
    setError(null);
    try {
      if (category === 'all') {
        const results = await Promise.all(
          HOME_DIGEST_CATEGORIES.map((cat) =>
            fetchSignalNewsDigests({
              category: cat,
              ...utcRangeForLocalYmd(selectedYmd),
              limit: 80,
              batches: 20,
            }).catch(() => ({ items: [] as SignalApiNewsDigestItem[] })),
          ),
        );
        setItems(sortDigests(results.flatMap((page) => page.items)));
      } else {
        const page = await fetchSignalNewsDigests({
          category,
          ...utcRangeForLocalYmd(selectedYmd),
          limit: 80,
          batches: 20,
        });
        setItems(sortDigests(page.items));
      }
    } catch (e) {
      setError(formatSignalApiError(e, t, 'newsIssuesLoadError'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, selectedYmd, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <SafeAreaView style={styles.safe} edges={isWide ? [] : ['bottom']}>
      <WebWheelScrollView
        ref={scrollRef as never}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, isWide && styles.innerWide]}>
          {onBack ? (
            <View style={styles.paneTopBar}>
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel={t('commonBack')}
                style={({ pressed }) => [styles.paneBackBtn, pressed && styles.pressed]}>
                <FontAwesome name="chevron-left" size={13} color={theme.green} />
                <Text style={styles.paneBackText}>{t('commonBack')}</Text>
              </Pressable>
              <Text style={styles.paneTitle} numberOfLines={1}>
                {t('newsIssuesTitle')}
              </Text>
              <View style={styles.paneSpacer} />
            </View>
          ) : null}
          <View style={styles.header}>
            <View style={styles.categoryTabs}>
              {NEWS_ISSUES_CATEGORY_ORDER.map((key) => {
                const active = category === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setCategory(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.categoryTab, active && styles.categoryTabActive]}>
                    <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                      {key === 'all' ? t('newsIssuesCategoryAll') : t(NEWS_SEGMENT_LABEL[key])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <SignalDateNavigator
            label={formatDateLabel(selectedYmd, locale)}
            previousA11y={t('calendarDayPrevA11y')}
            nextA11y={t('calendarDayNextA11y')}
            labelA11y={t('insightOpenCalendar')}
            todayLabel={t('commonToday')}
            onPrevious={() => setSelectedYmd((prev) => shiftYmd(prev, -1))}
            onNext={() => setSelectedYmd((prev) => shiftYmd(prev, 1))}
            onPressLabel={openDatePicker}
            onToday={() => setSelectedYmd(todayYmd)}
            showToday={selectedYmd !== todayYmd}
            nextDisabled={selectedYmd >= todayYmd}
            style={styles.dateNav}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading && items.length === 0 ? (
            <View style={styles.loadingBox}>
              <SignalLoadingIndicator message={t('commonLoading')} />
            </View>
          ) : !loading && items.length === 0 ? (
            <Text style={styles.empty}>{t('newsIssuesEmpty')}</Text>
          ) : (
            <View style={styles.issueList}>
              {items.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <View key={item.id} style={styles.card}>
                    {(item.aiGenerated || item.topics.length > 0 || item.symbols.length > 0) ? (
                      <View style={styles.badgeRow}>
                        {item.aiGenerated ? (
                          <View style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>AI</Text>
                          </View>
                        ) : null}
                        {item.topics.slice(0, 5).map((topic) => (
                          <Text key={topic} style={styles.topicChip} numberOfLines={1}>
                            {topic}
                          </Text>
                        ))}
                        {item.symbols.slice(0, 4).map((symbol) => (
                          <Text key={symbol} style={[styles.topicChip, styles.symbolChip]} numberOfLines={1}>
                            {symbol}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.summary}>{item.summary}</Text>
                    <View style={styles.footerRow}>
                      <Text style={styles.meta} numberOfLines={1}>
                        {t('feedDigestSummary', {
                          count: String(item.count),
                          sources: String(item.sources.length),
                        })}
                      </Text>
                      <Pressable
                        onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        style={({ pressed }) => [styles.sourceToggle, pressed && styles.pressed]}>
                        <Text style={styles.sourceToggleText}>
                          {t(expanded ? 'feedDigestCollapse' : 'feedDigestExpand')}
                        </Text>
                      </Pressable>
                    </View>
                    {expanded ? (
                      <View style={styles.sourceList}>
                        {(item.sourceRefs || []).slice(0, 8).map((ref, index) => (
                          <Pressable
                            key={`${item.id}-${index}`}
                            onPress={ref.url ? () => void Linking.openURL(ref.url!).catch(() => null) : undefined}
                            accessibilityRole={ref.url ? 'link' : 'text'}
                            style={({ pressed }) => [styles.sourceRow, pressed && ref.url && styles.pressed]}>
                            <View style={styles.sourceTextCol}>
                              <Text style={styles.sourceTitle}>{ref.title || ref.sourceName || ref.url || ''}</Text>
                              {ref.sourceName ? <Text style={styles.sourceName}>{ref.sourceName}</Text> : null}
                            </View>
                            {ref.url ? <FontAwesome name="external-link" size={10} color={theme.green} /> : null}
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </WebWheelScrollView>
    </SafeAreaView>
  );

  return (
    <>
      {body}
      {datePickerSheet}
    </>
  );
}

function firstStringParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw || '').trim();
  return text || null;
}

export default function NewsIssuesScreen() {
  const params = useLocalSearchParams<{ category?: string; date?: string; digestId?: string }>();
  const { useTwoPane } = useResponsiveLayout();
  const { t } = useLocale();
  const initialCategory = parseCategory(params.category);
  const initialDate = parseDateParam(params.date);
  const initialDigestId = firstStringParam(params.digestId);
  const content = (
    <NewsIssuesContent
      embedded={useTwoPane}
      initialCategory={initialCategory}
      initialDate={initialDate}
      initialDigestId={initialDigestId}
    />
  );

  return useTwoPane ? (
    <IpadSidebarScreen title={t('newsIssuesTitle')} backHref="/(tabs)/more">
      {content}
    </IpadSidebarScreen>
  ) : (
    <>
      <Stack.Screen options={{ title: t('newsIssuesTitle') }} />
      {content}
    </>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    safe: { flex: 1, minHeight: 0, backgroundColor: theme.bg },
    scroll: { flex: 1, minHeight: 0 },
    scrollContent: { flexGrow: 1, paddingBottom: SCREEN_WIDE_SCROLL_BOTTOM_BASE },
    inner: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: SCREEN_HEADER_CONTENT_GAP,
      gap: 12,
    },
    innerWide: {
      maxWidth: APP_WIDE_CONTENT_MAX_WIDTH,
      paddingHorizontal: SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
      paddingTop: SCREEN_EMBEDDED_WIDE_PADDING_TOP,
    },
    paneTopBar: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 2,
    },
    paneBackBtn: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    paneBackText: {
      fontSize: sf(13),
      lineHeight: sf(17),
      fontWeight: '900',
      color: theme.green,
    },
    paneTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    paneSpacer: {
      width: 78,
      flexShrink: 0,
    },
    header: { gap: 12 },
    title: {
      fontSize: sf(22),
      lineHeight: sf(28),
      fontWeight: '900',
      color: theme.text,
    },
    categoryTabs: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    categoryTab: {
      flex: 1,
      minHeight: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryTabActive: { backgroundColor: theme.green },
    categoryTabText: {
      fontSize: sf(13),
      lineHeight: sf(17),
      fontWeight: '800',
      color: theme.textDim,
    },
    categoryTabTextActive: { color: '#FFFFFF' },
    dateNav: { marginTop: 2 },
    loadingBox: { flex: 1, minHeight: 260, paddingVertical: 56, alignItems: 'center', justifyContent: 'center' },
    listLoadingRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    errorBox: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: theme.border,
    },
    errorText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '800',
      color: theme.danger,
    },
    empty: {
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      color: theme.textMuted,
      fontSize: sf(14),
      lineHeight: sf(20),
      fontWeight: '800',
      textAlign: 'center',
    },
    issueList: { gap: 10 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: ft.pad(14),
      gap: 9,
    },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    aiBadge: {
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiBadgeText: { color: '#FFFFFF', fontSize: sf(10), lineHeight: sf(14), fontWeight: '900' },
    topicChip: {
      overflow: 'hidden',
      maxWidth: 180,
      minHeight: 22,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.emphasisWeight,
    },
    symbolChip: {
      color: theme.green,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    cardTitle: {
      color: theme.text,
      fontSize: ft.ff(17),
      lineHeight: ft.ff(24),
      fontWeight: ft.titleWeight,
    },
    summary: {
      color: theme.textMuted,
      fontSize: ft.ff(13),
      lineHeight: ft.ff(20),
      fontWeight: ft.bodyWeight,
    },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    meta: {
      flex: 1,
      minWidth: 0,
      color: theme.textDim,
      fontSize: ft.ff(12),
      fontWeight: ft.metaWeight,
    },
    sourceToggle: {
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
    },
    sourceToggleText: {
      color: theme.green,
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.emphasisWeight,
    },
    sourceList: {
      overflow: 'hidden',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    sourceTextCol: { flex: 1, minWidth: 0, gap: 2 },
    sourceTitle: {
      color: theme.text,
      fontSize: ft.ff(13),
      lineHeight: ft.ff(18),
      fontWeight: ft.bodyWeight,
    },
    sourceName: {
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.metaWeight,
    },
    pressed: { opacity: 0.75 },
  });
}
