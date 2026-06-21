import { useFocusEffect } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  type HomeDigestCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import { APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import type { SignalApiMarketBriefing, SignalApiNewsDigestItem } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import type { CalendarEvent } from '@/types/signal';
import { toYmd } from '@/utils/date';

const HOME_DIGEST_LIMIT = 3;
const HOME_CALENDAR_LIMIT = 6;

type DigestState = Record<HomeDigestCategory, SignalApiNewsDigestItem[]>;

function emptyDigestState(): DigestState {
  return { global: [], korea: [], crypto: [] };
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
  return new Date(y, m - 1, d);
}

function localeForDate(locale: 'ko' | 'en' | 'ja'): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'ja') return 'ja-JP';
  return 'ko-KR';
}

function formatTodayHeading(value: string, locale: 'ko' | 'en' | 'ja'): string {
  try {
    return new Intl.DateTimeFormat(localeForDate(locale), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(parseYmd(value));
  } catch {
    return value;
  }
}

function sortDigestItems(items: SignalApiNewsDigestItem[]): SignalApiNewsDigestItem[] {
  return [...items]
    .sort(
      (a, b) =>
        (b.count - a.count) ||
        String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')),
    )
    .slice(0, HOME_DIGEST_LIMIT);
}

async function fetchTopDigestsForCategory(category: HomeDigestCategory): Promise<SignalApiNewsDigestItem[]> {
  const page = await fetchSignalNewsDigests({ category, limit: 30, batches: 3 }).catch(
    () => ({ items: [] as SignalApiNewsDigestItem[] }),
  );
  return sortDigestItems(page.items);
}

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
}

function calendarTypeLabel(type: CalendarEvent['type'], t: (id: MessageId) => string): string {
  if (type === 'earnings') return t('calendarTagEarnings');
  if (type === 'fomc') return t('calendarTagFomc');
  if (type === 'fed') return t('calendarTagFed');
  if (type === 'holiday') return t('calendarTagHoliday');
  return t('calendarTagMacro');
}

function briefingLeadText(briefing: SignalApiMarketBriefing): string {
  const summary = String(briefing.summary || briefing.headline || '').trim();
  if (summary) return summary;
  return briefing.overview[0] || '';
}

export function IpadHomeScreen() {
  const router = useRouter();
  const ipadNav = useIpadSidebarNav();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const todayLabel = useMemo(() => formatTodayHeading(todayYmd, locale), [locale, todayYmd]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digests, setDigests] = useState<DigestState>(emptyDigestState);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setDigests(emptyDigestState());
      setBriefings([]);
      setCalendarEvents([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    setError(null);
    try {
      const [digestResults, briefingRows, calendarRows] = await Promise.all([
        Promise.all(
          HOME_DIGEST_CATEGORIES.map(async (category) => {
            const items = await fetchTopDigestsForCategory(category);
            return [category, items] as const;
          }),
        ),
        fetchSignalMarketBriefings({ date: todayYmd, limit: 30 }).catch(() => []),
        fetchSignalCalendar({ from: todayYmd, to: todayYmd, limit: 40 }).catch(() => []),
      ]);

      const nextDigests = emptyDigestState();
      for (const [category, items] of digestResults) {
        nextDigests[category] = items;
      }
      setDigests(nextDigests);
      setBriefings(briefingRows);
      setCalendarEvents(
        sortDayEvents(
          calendarRows
            .map((row) => signalCalendarToCalendarEvent(row))
            .filter((row): row is CalendarEvent => row != null),
        ),
      );
    } catch (e) {
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [t, todayYmd]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        try {
          await load();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const briefingBySession = useMemo(() => {
    const map = new Map<SignalSessionKey, SignalApiMarketBriefing>();
    for (const tab of HOME_SIGNAL_SESSIONS) {
      const match = briefings.find((row) => row.market === tab.market && row.session === tab.session);
      if (match) map.set(tab.key, match);
    }
    return map;
  }, [briefings]);

  const visibleCalendarEvents = calendarEvents.slice(0, HOME_CALENDAR_LIMIT);
  const hiddenCalendarCount = Math.max(0, calendarEvents.length - visibleCalendarEvents.length);

  const goNews = useCallback(
    (segment: HomeDigestCategory) => {
      ipadNav.showNewsTab(segment);
      router.navigate('/(tabs)/news' as never);
    },
    [ipadNav, router],
  );

  const goSignal = useCallback(
    (session: SignalSessionKey) => {
      ipadNav.showSignalTab(session);
      router.navigate('/(tabs)/signal' as never);
    },
    [ipadNav, router],
  );

  const goCalendar = useCallback(() => {
    ipadNav.showTabs();
    router.navigate('/calendar' as never);
  }, [ipadNav, router]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <View style={styles.inner}>
        <View style={styles.pageHead}>
          <Text style={styles.pageTitle}>{t('ipadHomeTitle')}</Text>
          <Text style={styles.pageDate}>{todayLabel}</Text>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <>
            <HomeSection
              title={t('ipadHomeIssuesTitle')}
              subtitle={t('ipadHomeIssuesSubtitle')}
              styles={styles}>
              <View style={styles.sectionStack}>
                {HOME_DIGEST_CATEGORIES.map((category) => {
                  const items = digests[category];
                  return (
                    <View key={category} style={styles.blockCard}>
                      <View style={styles.blockHeader}>
                        <Text style={styles.blockHeaderTitle}>{t(NEWS_SEGMENT_LABEL[category])}</Text>
                      </View>
                      <View style={styles.blockBody}>
                        {items.length === 0 ? (
                          <Text style={styles.emptyLine}>{t('ipadHomeIssuesEmpty')}</Text>
                        ) : (
                          items.map((item, index) => (
                            <Pressable
                              key={item.id}
                              onPress={() => goNews(category)}
                              accessibilityRole="button"
                              style={({ pressed }) => [
                                styles.issueRow,
                                index < items.length - 1 && styles.issueRowBorder,
                                pressed && styles.pressed,
                              ]}>
                              <Text style={styles.issueTitle} numberOfLines={2}>
                                {item.title}
                              </Text>
                              <Text style={styles.issueMeta} numberOfLines={1}>
                                {t('feedDigestSummary', {
                                  count: String(item.count),
                                  sources: String(item.sources.length),
                                })}
                              </Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </HomeSection>

            <HomeSection
              title={t('ipadHomeSignalTitle')}
              subtitle={t('ipadHomeSignalSubtitle')}
              styles={styles}>
              <View style={styles.sectionStack}>
                {HOME_SIGNAL_SESSIONS.map((session) => {
                  const briefing = briefingBySession.get(session.key);
                  const lead = briefing ? briefingLeadText(briefing) : '';
                  const overview = briefing?.overview.slice(0, 2) || [];
                  return (
                    <Pressable
                      key={session.key}
                      onPress={() => goSignal(session.key)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.blockCard, pressed && styles.pressed]}>
                      <View style={styles.blockHeader}>
                        <Text style={styles.blockHeaderTitle}>{t(session.labelId)}</Text>
                        <Text style={styles.blockHeaderHint} numberOfLines={1}>
                          {t(session.hintId)}
                        </Text>
                      </View>
                      <View style={styles.blockBody}>
                        {briefing && lead ? (
                          <>
                            <Text style={styles.signalSummary} numberOfLines={3}>
                              {lead}
                            </Text>
                            {overview.length > 0 ? (
                              <View style={styles.signalBullets}>
                                {overview.map((line, index) => (
                                  <View key={`${session.key}-${index}`} style={styles.signalBulletRow}>
                                    <View style={styles.signalBulletDot} />
                                    <Text style={styles.signalBulletText} numberOfLines={2}>
                                      {line}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </>
                        ) : (
                          <Text style={styles.emptyLine}>{t('briefingSessionEmptyTitle')}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </HomeSection>

            <HomeSection
              title={t('ipadHomeCalendarTitle')}
              subtitle={t('ipadHomeCalendarSubtitle')}
              styles={styles}>
              <View style={styles.blockCard}>
                <View style={styles.blockBody}>
                  {visibleCalendarEvents.length === 0 ? (
                    <Text style={styles.emptyLine}>{t('ipadHomeCalendarEmpty')}</Text>
                  ) : (
                    <>
                      {visibleCalendarEvents.map((event, index) => (
                        <Pressable
                          key={event.id}
                          onPress={goCalendar}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.calendarRow,
                            index < visibleCalendarEvents.length - 1 && styles.calendarRowBorder,
                            pressed && styles.pressed,
                          ]}>
                          <Text style={styles.calendarTime}>{event.time || '—'}</Text>
                          <View style={styles.calendarBody}>
                            <View style={styles.calendarTitleLine}>
                              <View style={styles.calendarTypeTag}>
                                <Text style={styles.calendarTypeTagText}>
                                  {calendarTypeLabel(event.type, t)}
                                </Text>
                              </View>
                              <Text style={styles.calendarTitle} numberOfLines={2}>
                                {event.title}
                              </Text>
                            </View>
                            {event.country ? (
                              <Text style={styles.calendarMeta} numberOfLines={1}>
                                {event.country}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                      {hiddenCalendarCount > 0 ? (
                        <Pressable
                          onPress={goCalendar}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.calendarMoreBtn, pressed && styles.pressed]}>
                          <Text style={styles.calendarMoreText}>
                            {t('ipadHomeCalendarMore', { count: String(hiddenCalendarCount) })}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            </HomeSection>
          </>
        )}
      </View>
    </ScrollView>
  );
}

type HomeSectionProps = {
  title: string;
  subtitle: string;
  styles: ReturnType<typeof makeStyles>;
  children: ReactNode;
};

function HomeSection({ title, subtitle, styles, children }: HomeSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderBand}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 32,
    },
    inner: {
      width: '100%',
      maxWidth: APP_WIDE_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 16,
    },
    pageHead: {
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
      paddingVertical: 8,
    },
    pageTitle: {
      fontSize: sf(24),
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    pageDate: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.textMuted,
      textAlign: 'center',
    },
    loadingBox: {
      paddingVertical: 48,
      alignItems: 'center',
    },
    errBox: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
    },
    errText: {
      fontSize: sf(12),
      color: theme.danger,
      lineHeight: sf(18),
    },
    sectionCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    sectionHeaderBand: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.bgElevated,
      gap: 2,
    },
    sectionTitle: {
      fontSize: sf(17),
      fontWeight: '800',
      color: theme.text,
    },
    sectionSubtitle: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
    },
    sectionBody: {
      padding: 12,
    },
    sectionStack: {
      gap: 10,
    },
    blockCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      overflow: 'hidden',
    },
    blockHeader: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.bgElevated,
      gap: 2,
    },
    blockHeaderTitle: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
    },
    blockHeaderHint: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textMuted,
    },
    blockBody: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    issueRow: {
      gap: 3,
      paddingVertical: 10,
    },
    issueRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    issueTitle: {
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(20),
    },
    issueMeta: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textMuted,
    },
    signalSummary: {
      fontSize: sf(14),
      fontWeight: '600',
      color: theme.text,
      lineHeight: sf(21),
      paddingVertical: 8,
    },
    signalBullets: {
      gap: 6,
      paddingBottom: 8,
    },
    signalBulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    signalBulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.green,
      marginTop: sf(7),
    },
    signalBulletText: {
      flex: 1,
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textDim,
      lineHeight: sf(18),
    },
    calendarRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
    },
    calendarRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    calendarTime: {
      width: 52,
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.textMuted,
      paddingTop: 2,
    },
    calendarBody: {
      flex: 1,
      gap: 2,
    },
    calendarTitleLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: 6,
    },
    calendarTypeTag: {
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 1,
    },
    calendarTypeTagText: {
      fontSize: sf(9),
      fontWeight: '800',
      color: theme.green,
    },
    calendarTitle: {
      flex: 1,
      minWidth: 120,
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(20),
    },
    calendarMeta: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textMuted,
    },
    calendarMoreBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 2,
    },
    calendarMoreText: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.green,
    },
    emptyLine: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
      lineHeight: sf(18),
      paddingVertical: 10,
    },
    pressed: { opacity: 0.75 },
  });
}
