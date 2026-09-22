import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalCalendar } from '@/integrations/signal-api/calendar';
import type { SignalApiCalendarEvent, SignalApiDisclosure, SignalApiMarketBriefing, SignalApiNewsDigestItem } from '@/integrations/signal-api/types';
import { companyTimeline } from '@/domain/symbols/companyTimeline';
import type { NewsItem } from '@/types/signal';
import { formatFeedItemTimeLabel, toYmd, utcRangeForLocalYmd } from '@/utils/date';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';

export function CompanyDevelopments({ ticker, news, filings, refreshing }: { ticker: string; news: NewsItem[]; filings: SignalApiDisclosure[]; refreshing: boolean }) {
  const { theme, feedTypo: ft } = useSignalTheme();
  const { t, locale } = useLocale();
  const router = useRouter();
  const [issues, setIssues] = useState<SignalApiNewsDigestItem[]>([]);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [events, setEvents] = useState<SignalApiCalendarEvent[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(true);
  const [retry, setRetry] = useState(0);
  const previousRefresh = useRef(refreshing);
  const previousScope = useRef('');
  const completedRetry = useRef(0);
  useEffect(() => {
    if (refreshing && !previousRefresh.current) setRetry((value) => value + 1);
    previousRefresh.current = refreshing;
  }, [refreshing]);
  useEffect(() => {
    let active = true;
    const scope = `${ticker}:${locale}`;
    if (previousScope.current !== scope) {
      setIssues([]); setBriefings([]); setEvents([]);
    }
    previousScope.current = scope;
    setFailed(false); setPending(true);
    const now = new Date();
    const from = utcRangeForLocalYmd(toYmd(new Date(now.getTime() - 7 * 86400000))).from;
    const to = utcRangeForLocalYmd(toYmd(now)).to;
    const options = { cacheMode: retry !== completedRetry.current ? 'bypass' as const : 'use' as const };
    completedRetry.current = retry;
    let remaining = 3;
    function receive<T>(request: Promise<T>, commit: (value: T) => void) {
      void request.then((value) => { if (active) commit(value); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active && --remaining === 0) setPending(false); });
    }
    receive(fetchSignalNewsDigests({ symbols: ticker, from, to, limit: 12, locale }, options), (page) => setIssues(page.items));
    receive(fetchSignalMarketBriefings({ market: /^\d/.test(ticker) ? 'kr' : 'us', from, to, limit: 28, locale }, options), setBriefings);
    receive(fetchSignalCalendar({ type: 'earnings', symbol: ticker, from: toYmd(now), to: toYmd(new Date(now.getTime() + 90 * 86400000)), limit: 3 }, options), setEvents);
    return () => { active = false; };
  }, [ticker, locale, retry]);
  const rows = useMemo(() => companyTimeline(ticker, news, filings, issues, briefings), [ticker, news, filings, issues, briefings]);
  const text = { color: theme.textMuted, fontSize: ft.ff(13), lineHeight: ft.ff(20) };
  return <View style={{ gap: 12 }}>
    <HomeSectionHeader title={t('companyTimeline')} showChevron={false} />
    {failed ? <Pressable accessibilityRole="button" onPress={() => setRetry((n) => n + 1)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...text, color: theme.danger }}>{t('companyTimelineRetry')}</Text></Pressable> : null}
    {events.map((event) => <Pressable key={event.id} accessibilityRole="button" onPress={() => router.push('/calendar')} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ ...text, color: theme.green }}>{t('companyUpcomingEarnings')} · {event.date}</Text><Text style={text}>{event.title}</Text>
    </Pressable>)}
    {rows.map((row, index) => <HomeDigestFeedRow key={row.id} title={row.title} summary={row.summary} summaryLines={2} titleLines={3}
      timeLabel={formatFeedItemTimeLabel(row.at, locale)} trailText={row.source || t(row.kind === 'filing' ? 'screenDisclosures' : row.kind === 'briefing' ? 'companyBriefing' : 'tabNews')}
      bordered={index < rows.length - 1} onPress={() => { if (row.route) router.push(row.route as Href); else if (row.url) void openConfiguredExternalLink({ webUrl: row.url }).catch(() => {}); }} />)}
    {!rows.length && !events.length ? <Text style={text}>{t(pending ? 'commonLoading' : failed ? 'homeNewsUnavailable' : 'symbolDetailNoNews')}</Text> : null}
  </View>;
}
