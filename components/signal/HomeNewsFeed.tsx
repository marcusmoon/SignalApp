import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebHorizontalScrollStrip } from '@/components/layout/WebHorizontalScrollStrip';
import { HomeDigestFeedRow } from './HomeDigestFeedRow';
import { HomeSectionHeader } from './HomeSectionHeader';
import { HomeSectionLeadIcon } from './HomeSectionLeadIcon';
import { digestSourceIconEntries } from './SourceIconStack';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { newsSegmentAccent } from '@/constants/segmentAccent';
import {
  hasReadNews,
  selectHomeNews,
  type HomeNewsRow,
  type NewsReadHistory,
} from '@/domain/home/newsReading';
import { isHomeNewsFlowNew } from '@/domain/digests/freshness';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import { formatFeedItemTimeLabel } from '@/utils/date';
import { loadNewsReadingHistory, subscribeNewsReadingHistory } from '@/services/newsReadingHistory';
import { loadSavedNews, subscribeSavedNews } from '@/services/savedNews';
import { type SavedNews } from '@/domain/home/newsLibrary';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import { utcRangeForLocalYmd } from '@/utils/date';
import { shiftLocalYmd } from '@/utils/date';
import { FOCUS_TARGETS, focusSymbols, focusTargetNames } from '@/domain/home/focusUniverse';

type Props = {
  rows: HomeNewsRow[];
  selectedYmd: string;
  refreshing?: boolean;
  limit: number;
  pending: boolean;
  failed: boolean;
  onOpen: (row: HomeNewsRow) => void;
};

export function HomeNewsFeed({
  rows,
  selectedYmd,
  refreshing = false,
  limit,
  pending,
  failed,
  onOpen,
}: Props) {
  const { theme, feedTypo: ft } = useSignalTheme();
  const { t, locale } = useLocale();
  const [scope, setScope] = useState<'all' | 'watch' | 'saved'>('watch');
  const [targetId, setTargetId] = useState('all');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const [visibleCount, setVisibleCount] = useState(limit);
  const previousRefreshing = useRef(refreshing);
  useEffect(() => {
    if (refreshing && !previousRefreshing.current) setRefreshVersion((value) => value + 1);
    previousRefreshing.current = refreshing;
  }, [refreshing]);
  useEffect(() => { setVisibleCount(limit); }, [limit, targetId, selectedYmd, scope]);
  const [saved, setSaved] = useState<SavedNews[]>([]);
  const [watchRows, setWatchRows] = useState<HomeNewsRow[]>([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchFailed, setWatchFailed] = useState(false);
  const watchlist = useMemo(() => focusSymbols(targetId), [targetId]);
  const watchKey = watchlist.join(',');
  const completedRefresh = useRef('0:0');
  const previousWatchScope = useRef('');
  useEffect(() => {
    let active = true;
    void loadSavedNews().then((value) => { if (active) setSaved(value); });
    const unsubscribe = subscribeSavedNews(setSaved);
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (scope !== 'watch') return;
    let active = true;
    const queryScope = `${watchKey}|${selectedYmd}|${locale}`;
    if (previousWatchScope.current !== queryScope) setWatchRows([]);
    previousWatchScope.current = queryScope;
    setWatchFailed(false);
    if (!watchKey) { setWatchLoading(false); return; }
    setWatchLoading(true);
    const version = `${refreshVersion}:${retryVersion}`;
    const bypass = completedRefresh.current !== version;
    completedRefresh.current = version;
    const fromYmd = shiftLocalYmd(selectedYmd, -6);
    void fetchSignalNewsDigests({ symbols: watchKey, from: utcRangeForLocalYmd(fromYmd).from, to: utcRangeForLocalYmd(selectedYmd).to, limit: 100, locale }, { cacheMode: bypass ? 'bypass' : 'use' })
      .then((page) => { if (active) setWatchRows(page.items.filter((item) => ['global', 'korea', 'crypto'].includes(item.category)).map((item) => ({ category: item.category as HomeNewsRow['category'], item }))); })
      .catch(() => { if (active) setWatchFailed(true); })
      .finally(() => { if (active) setWatchLoading(false); });
    return () => { active = false; };
  }, [scope, watchKey, selectedYmd, locale, refreshVersion, retryVersion]);
  const [history, setHistory] = useState<NewsReadHistory>({});
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeNewsReadingHistory(setHistory);
    void loadNewsReadingHistory().then((value) => {
      if (active) setHistory(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const visible = useMemo(
    () => scope === 'saved' ? saved.map(({ item }) => ({ item, category: item.category as HomeNewsRow['category'] })) : selectHomeNews(scope === 'watch' ? watchRows : rows, watchlist, scope, visibleCount),
    [rows, watchRows, watchlist, scope, visibleCount, saved],
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { gap: 12, minWidth: 0 },
        tabs: {
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          gap: 20,
        },
        tab: {
          minHeight: 44,
          justifyContent: 'center',
          borderBottomWidth: 2,
          borderBottomColor: 'transparent',
        },
        tabText: { color: theme.textMuted, fontSize: ft.ff(14), fontWeight: ft.metaWeight },
        selected: { borderBottomColor: theme.green },
        selectedText: { color: theme.green, fontWeight: ft.emphasisWeight },
        list: {
          backgroundColor: theme.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 16,
        },
        category: { color: theme.textMuted, fontSize: ft.ff(12), fontWeight: ft.metaWeight },
        symbol: { color: theme.text, fontSize: ft.ff(12), fontWeight: ft.metaWeight },
        badge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 8 },
        dot: { width: 6, height: 6, borderRadius: 3 },
        read: { marginLeft: 'auto', color: theme.textDim, fontSize: ft.ff(12) },
        empty: {
          paddingVertical: 24,
          color: theme.textMuted,
          fontSize: ft.ff(14),
          lineHeight: ft.ff(21),
        },
        action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
        actionText: { fontSize: ft.ff(14), color: theme.green },
        skeleton: {
          height: 12,
          backgroundColor: theme.bgElevated,
          borderRadius: 4,
          marginBottom: 12,
        },
        placeholder: { paddingVertical: 20 },
      }),
    [theme, ft],
  );

  return (
    <View style={styles.section}>
      <HomeSectionHeader
        title={t('focusNewsTitle')}
        badge={<HomeSectionLeadIcon name="newspaper-outline" />}
      />
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['watch', 'all', 'saved'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === value }}
            onPress={() => setScope(value)}
            style={[styles.tab, scope === value && styles.selected]}>
            <Text style={[styles.tabText, scope === value && styles.selectedText]}>
              {t(value === 'all' ? 'homeNewsAll' : value === 'watch' ? 'focusNewsTab' : 'newsSaved')}
            </Text>
          </Pressable>
        ))}
      </View>
      {scope === 'watch' ? <>
        <WebHorizontalScrollStrip contentContainerStyle={{ gap: 8 }}>
          {[{ id: 'all', name: { ko: '전체 10', en: 'All 10', ja: 'すべて 10' } }, ...FOCUS_TARGETS].map((target) => <Pressable
            key={target.id} accessibilityRole="button" accessibilityState={{ selected: targetId === target.id }}
            onPress={() => setTargetId(target.id)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, backgroundColor: targetId === target.id ? theme.greenDim : theme.bgElevated, borderWidth: 1, borderColor: targetId === target.id ? theme.green : theme.border }}>
            <Text style={{ color: targetId === target.id ? theme.green : theme.textMuted, fontSize: ft.ff(13) }}>{target.name[locale]}</Text>
          </Pressable>)}
        </WebHorizontalScrollStrip>
        <Text style={styles.category}>{t('focusNewsPeriod')}</Text>
      </> : null}
      {scope === 'watch' && watchFailed ? <Pressable accessibilityRole="button" onPress={() => setRetryVersion((value) => value + 1)} style={styles.action}><Ionicons name="refresh-outline" size={18} color={theme.green} /><Text style={styles.actionText}>{t('commonRetry')}</Text></Pressable> : null}
      {scope === 'watch' && watchFailed && visible.length > 0 ? <Text style={[styles.category, { color: theme.danger }]}>{t('homeNewsUnavailable')}</Text> : null}
      <View style={styles.list}>
        {visible.map((row, index) => {
          const read = hasReadNews(history, row.item, locale);
          const matched = focusTargetNames(row.item.symbols, locale);
          const sourceNames = [
            ...new Set(
              [...row.item.sourceRefs.map((ref) => ref.sourceName), ...row.item.sources].filter(
                Boolean,
              ),
            ),
          ];
          const created = newsDigestCreatedIso(row.item);
          return (
            <HomeDigestFeedRow
              key={row.item.id}
              density="home"
              featured={index === 0 && scope !== 'saved'}
              title={row.item.title}
              titleLines={3}
              summary={row.item.changeType && row.item.changeType !== 'new' ? row.item.changes?.map((change) => change.text).join(' ') || row.item.summary : row.item.summary.trim() !== row.item.title.trim() ? row.item.summary : null}
              summaryLines={index === 0 ? 3 : 1}
              trailText={sourceNames.slice(0, 2).join(' · ')}
              sourceEntries={digestSourceIconEntries(row.item.sourceRefs, row.item.sources)}
              timeLabel={formatFeedItemTimeLabel(created, locale)}
              isFresh={!read && isHomeNewsFlowNew(created)}
              bordered={index < visible.length - 1}
              onPress={() => onOpen(row)}
              badges={
                <>
                  {row.item.changeType && row.item.changeType !== 'new' ? <Text style={[styles.category, { color: theme.green }]}>{t(row.item.changeType === 'correction' ? 'newsRevisionCorrection' : 'newsRevisionUpdate')}</Text> : null}
                  <View style={styles.badge}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: newsSegmentAccent(row.category, theme).accent },
                      ]}
                    />
                    <Text style={styles.category}>{t(NEWS_SEGMENT_LABEL[row.category])}</Text>
                  </View>
                  {[
                    ...new Set(
                      matched
                        .slice(0, 2)
                        .map((name) => name),
                    ),
                  ].map((label) => (
                    <View style={styles.badge} key={label}>
                      <Ionicons name="star" size={11} color={theme.green} />
                      <Text style={styles.symbol}>{label}</Text>
                    </View>
                  ))}
                  {read ? <Text style={styles.read}>{t('homeNewsRead')}</Text> : null}
                </>
              }
            />
          );
        })}
        {visible.length === 0 ? (
          (scope === 'watch' ? watchLoading : scope === 'saved' ? false : pending) ? (
            <View
              style={styles.placeholder}
              accessibilityLabel={t('commonLoading')}
              accessibilityState={{ busy: true }}>
              <View style={styles.skeleton} />
              <View style={[styles.skeleton, { width: '75%' }]} />
              <View style={[styles.skeleton, { width: '45%' }]} />
            </View>
          ) : (
            <>
              <Text style={styles.empty}>
                {t(
                  (scope === 'watch' ? watchFailed : scope === 'saved' ? false : failed)
                    ? 'homeNewsUnavailable'
                    : scope === 'watch'
                      ? 'focusNewsEmpty'
                      : scope === 'saved' ? 'newsSavedEmpty' : 'newsDigestEmpty',
                )}
              </Text>
            </>
          )
        ) : null}
      </View>
      {scope === 'watch' && selectHomeNews(watchRows, watchlist, 'watch', 100).length > visible.length ? <Pressable accessibilityRole="button" style={styles.action} onPress={() => setVisibleCount((value) => value + 6)}><Text style={styles.actionText}>{t('focusNewsMore')}</Text><Ionicons name="chevron-down" size={18} color={theme.green} /></Pressable> : null}
    </View>
  );
}
