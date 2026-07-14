import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { AiBadge } from '@/components/signal/AiBadge';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { HomeSectionAccentLine } from '@/components/signal/HomeSectionAccentLine';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { digestSourceIconEntries } from '@/components/signal/SourceIconStack';
import {
  FEED_BADGE_PX,
  FEED_BODY_PX,
} from '@/constants/feedTypography';
import { COMFORT_GAP_SM, COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import { HOME_DIGEST_CATEGORIES, NEWS_ISSUES_CATEGORY_ORDER, homeDigestCategoryIcon, type HomeDigestCategory, type NewsIssuesCategory } from '@/constants/ipadHomeNav';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_HEADER_CONTENT_GAP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';
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
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { formatFeedItemTimeLabel, toYmd, utcRangeForLocalYmd } from '@/utils/date';

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

function digestCategory(item: SignalApiNewsDigestItem): HomeDigestCategory | null {
  const key = String(item.category || '').trim();
  return HOME_DIGEST_CATEGORIES.includes(key as HomeDigestCategory) ? (key as HomeDigestCategory) : null;
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
  const setRouteParams = useSafeSetRouteParams();
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
  const scrollResetKey = `${category}:${selectedYmd}`;

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSelectedYmd(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setExpandedId(initialDigestId);
  }, [initialDigestId]);

  const syncRoute = useCallback(
    (next: { category?: NewsIssuesCategory; date?: string; digestId?: string | null }) => {
      const nextCategory = next.category ?? category;
      const nextDate = next.date ?? selectedYmd;
      const nextDigestId = next.digestId === undefined ? expandedId : next.digestId;
      setRouteParams({
        category: nextCategory === 'all' ? undefined : nextCategory,
        date: nextDate,
        digestId: nextDigestId || undefined,
      });
    },
    [category, expandedId, selectedYmd, setRouteParams],
  );

  const onPickCategory = useCallback(
    (key: NewsIssuesCategory) => {
      if (key === category) return;
      setCategory(key);
      syncRoute({ category: key });
    },
    [category, syncRoute],
  );

  const onPickDate = useCallback(
    (ymd: string) => {
      if (ymd === selectedYmd) return;
      setSelectedYmd(ymd);
      syncRoute({ date: ymd });
    },
    [selectedYmd, syncRoute],
  );

  const onToggleExpand = useCallback(
    (id: string) => {
      const next = expandedId === id ? null : id;
      setExpandedId(next);
      syncRoute({ digestId: next });
    },
    [expandedId, syncRoute],
  );

  const { openDatePicker, datePickerSheet } = useSignalDatePickerSheet({
    selectedYmd,
    todayYmd,
    onSelectYmd: onPickDate,
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
              locale,
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
          locale,
        });
        setItems(sortDigests(page.items));
      }
    } catch (e) {
      setError(formatSignalApiError(e, t, 'newsIssuesLoadError'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, locale, selectedYmd, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <SafeAreaView style={styles.safe} edges={isWide ? [] : ['bottom']}>
      <WebWheelScrollView
        ref={scrollRef as never}
        scrollResetKey={scrollResetKey}
        contentRevision={items}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, isWide && styles.innerWide]}>
          {onBack ? (
            <WideSubpaneHeader title={t('newsIssuesTitle')} onBack={onBack} />
          ) : null}
          <View style={styles.header}>
            <View style={styles.categoryTabs}>
              {NEWS_ISSUES_CATEGORY_ORDER.map((key) => {
                const active = category === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => onPickCategory(key)}
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
            onPrevious={() => onPickDate(shiftYmd(selectedYmd, -1))}
            onNext={() => onPickDate(shiftYmd(selectedYmd, 1))}
            onPressLabel={openDatePicker}
            onToday={() => onPickDate(todayYmd)}
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
                const itemCat = digestCategory(item);
                const sourceEntries = digestSourceIconEntries(item.sourceRefs, item.sources);
                const trailText = [item.topics[0], item.symbols[0]].filter(Boolean).join(' · ');
                return (
                  <View
                    key={item.id}
                    style={[styles.card, expanded && styles.cardExpanded]}>
                    <HomeSectionAccentLine section="issues" style={styles.cardAccent} />
                    <HomeDigestFeedRow
                      title={item.title}
                      titleLines={2}
                      timeLabel={formatFeedItemTimeLabel(newsDigestCreatedIso(item), locale)}
                      trailText={trailText || null}
                      summary={item.summary}
                      summaryLines={3}
                      sourceEntries={sourceEntries}
                      badges={
                        <>
                          {item.aiGenerated ? <AiBadge /> : null}
                          {category === 'all' && itemCat ? (
                            <View style={styles.categoryMark}>
                              <FontAwesome
                                name={homeDigestCategoryIcon(itemCat)}
                                size={10}
                                color={theme.textMuted}
                              />
                              <Text style={styles.categoryText}>{t(NEWS_SEGMENT_LABEL[itemCat])}</Text>
                            </View>
                          ) : null}
                        </>
                      }
                    />
                    <View style={styles.footerRow}>
                      <Text style={styles.meta} numberOfLines={1}>
                        {t('feedDigestSummary', {
                          count: String(item.count),
                          sources: String(item.sources.length),
                        })}
                      </Text>
                      <Pressable
                        onPress={() => onToggleExpand(item.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        style={({ pressed }) => [styles.sourceToggle, pressed && styles.pressed]}>
                        <Text style={styles.sourceToggleText}>
                          {t(expanded ? 'feedDigestCollapse' : 'feedDigestExpand')}
                        </Text>
                      </Pressable>
                    </View>
                    {expanded ? (
                      <View style={styles.detailSection}>
                        <HomeSectionHeader title={t('feedDigestSourcesTitle')} showChevron={false} />
                        <View style={[styles.feedCard, styles.feedCardCompact]}>
                          <View style={styles.sourceList}>
                            {(item.sourceRefs || []).slice(0, 8).map((ref, index, rows) => (
                              <HomeDigestFeedRow
                                key={`${item.id}-${index}`}
                                title={ref.title || ref.sourceName || ref.url || ''}
                                titleLines={3}
                                trailText={ref.sourceName?.trim() || null}
                                sourceEntries={digestSourceIconEntries([ref])}
                                timeLabel={
                                  ref.publishedAt
                                    ? formatFeedItemTimeLabel(ref.publishedAt, locale)
                                    : null
                                }
                                bordered={index < rows.length - 1}
                                onPress={
                                  ref.url
                                    ? () => void Linking.openURL(ref.url!).catch(() => null)
                                    : undefined
                                }
                              />
                            ))}
                          </View>
                        </View>
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

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="news-issues"
        params={{
          category: initialCategory,
          date: initialDate,
          ...(initialDigestId ? { digestId: initialDigestId } : {}),
        }}
      />
    );
  }

  const content = (
    <NewsIssuesContent
      embedded={false}
      initialCategory={initialCategory}
      initialDate={initialDate}
      initialDigestId={initialDigestId}
    />
  );

  return (
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
      gap: 20,
    },
    innerWide: {
      maxWidth: APP_WIDE_CONTENT_MAX_WIDTH,
      paddingHorizontal: SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
      paddingTop: SCREEN_EMBEDDED_WIDE_PADDING_TOP,
    },
    header: { gap: 20 },
    title: {
      fontSize: sf(22),
      lineHeight: sf(28),
      fontWeight: '700',
      color: theme.text,
    },
    categoryTabs: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: 8,
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
      fontWeight: '600',
      color: theme.textDim,
    },
    categoryTabTextActive: { color: '#FFFFFF' },
    dateNav: { marginTop: 2 },
    loadingBox: { flex: 1, minHeight: 260, paddingVertical: 56, alignItems: 'center', justifyContent: 'center' },
    listLoadingRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    errorBox: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: theme.border,
    },
    errorText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.danger,
    },
    empty: {
      padding: 18,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      color: theme.textMuted,
      fontSize: sf(14),
      lineHeight: sf(20),
      fontWeight: '600',
      textAlign: 'center',
    },
    issueList: { gap: 16 },
    card: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingLeft: 18,
      paddingRight: ft.pad(14),
      paddingVertical: ft.pad(14),
      gap: COMFORT_GAP_SM,
    },
    cardExpanded: {
      borderColor: theme.greenBorder,
    },
    cardAccent: {
      borderTopLeftRadius: UI_RADIUS_CARD_LG,
      borderBottomLeftRadius: UI_RADIUS_CARD_LG,
    },
    categoryMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
      flexShrink: 0,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryText: {
      color: theme.textMuted,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
    meta: {
      flex: 1,
      minWidth: 0,
      color: theme.textDim,
      fontSize: ft.ff(FEED_BODY_PX),
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
      fontSize: ft.ff(FEED_BODY_PX),
      lineHeight: sf(16),
      fontWeight: ft.emphasisWeight,
    },
    detailSection: {
      gap: COMFORT_GAP_SM,
      marginTop: COMFORT_GAP_SM,
    },
    feedCard: {
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.colorScheme === 'dark' ? theme.bgElevated : theme.card,
      paddingHorizontal: 10,
      paddingVertical: COMFORT_PADDING_ROW_V,
      overflow: 'hidden',
    },
    feedCardCompact: {
      paddingVertical: 8,
    },
    sourceList: {
      gap: 0,
    },
    pressed: { opacity: 0.75 },
  });
}
