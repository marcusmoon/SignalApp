import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IpadSidebarScreen } from '@/components/layout/IpadSidebarScreen';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { HOME_DIGEST_CATEGORIES, type HomeDigestCategory } from '@/constants/ipadHomeNav';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import type { SignalApiNewsDigestItem } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { toYmd, utcRangeForLocalYmd } from '@/utils/date';

function parseCategory(value: unknown): HomeDigestCategory {
  const raw = String(Array.isArray(value) ? value[0] : value || '').trim();
  return HOME_DIGEST_CATEGORIES.includes(raw as HomeDigestCategory) ? (raw as HomeDigestCategory) : 'global';
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
  initialCategory?: HomeDigestCategory;
  initialDate?: string;
  initialDigestId?: string | null;
  onBack?: () => void;
};

export function NewsIssuesContent({
  embedded = false,
  initialCategory = 'global',
  initialDate = toYmd(new Date()),
  initialDigestId = null,
  onBack,
}: NewsIssuesContentProps) {
  const { useTwoPane } = useResponsiveLayout();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const isWide = embedded || useTwoPane;
  const [category, setCategory] = useState<HomeDigestCategory>(initialCategory);
  const [selectedYmd, setSelectedYmd] = useState(initialDate);
  const [items, setItems] = useState<SignalApiNewsDigestItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(initialDigestId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSelectedYmd(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setExpandedId(initialDigestId);
  }, [initialDigestId]);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setItems([]);
      setError(t('errorSignalApiShort'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await fetchSignalNewsDigests({
        category,
        ...utcRangeForLocalYmd(selectedYmd),
        limit: 80,
        batches: 20,
      });
      setItems(sortDigests(page.items));
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
              {HOME_DIGEST_CATEGORIES.map((key) => {
                const active = category === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setCategory(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.categoryTab, active && styles.categoryTabActive]}>
                    <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                      {t(NEWS_SEGMENT_LABEL[key])}
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
            todayLabel={t('commonToday')}
            onPrevious={() => setSelectedYmd((prev) => shiftYmd(prev, -1))}
            onNext={() => setSelectedYmd((prev) => shiftYmd(prev, 1))}
            onToday={() => setSelectedYmd(todayYmd)}
            showToday={selectedYmd !== todayYmd}
            style={styles.dateNav}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <SignalLoadingIndicator message={t('commonLoading')} />
            </View>
          ) : items.length === 0 ? (
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
      </ScrollView>
    </SafeAreaView>
  );

  return body;
}

export default function NewsIssuesScreen() {
  const params = useLocalSearchParams<{ category?: string; date?: string; digestId?: string }>();
  const { useTwoPane } = useResponsiveLayout();
  const { t } = useLocale();
  const initialCategory = parseCategory(params.category);
  const initialDate = parseDateParam(params.date);
  const initialDigestId = typeof params.digestId === 'string' ? params.digestId : null;
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
    content
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: 32 },
    inner: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 12,
    },
    innerWide: {
      maxWidth: APP_WIDE_CONTENT_MAX_WIDTH,
      paddingHorizontal: 20,
      paddingTop: 16,
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
    loadingBox: { paddingVertical: 56, alignItems: 'center' },
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
      padding: 14,
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
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
    },
    symbolChip: {
      color: theme.green,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    cardTitle: { color: theme.text, fontSize: sf(17), lineHeight: sf(24), fontWeight: '900' },
    summary: { color: theme.textMuted, fontSize: sf(13), lineHeight: sf(20), fontWeight: '700' },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    meta: { flex: 1, minWidth: 0, color: theme.textDim, fontSize: sf(12), fontWeight: '800' },
    sourceToggle: {
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
    },
    sourceToggleText: { color: theme.green, fontSize: sf(12), lineHeight: sf(16), fontWeight: '900' },
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
    sourceTitle: { color: theme.text, fontSize: sf(13), lineHeight: sf(18), fontWeight: '800' },
    sourceName: { color: theme.textMuted, fontSize: sf(11), lineHeight: sf(15), fontWeight: '700' },
    pressed: { opacity: 0.75 },
  });
}
