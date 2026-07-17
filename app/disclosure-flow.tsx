import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import {
  disclosureDigestSourceSheetRows,
} from '@/components/disclosures/DisclosureDigestSection';
import { DigestSourcesSheet } from '@/components/news/DigestSourcesSheet';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { digestSourceIconEntries } from '@/components/signal/SourceIconStack';
import { DISCLOSURE_FLOW_MARKET_ORDER, type DisclosureFlowMarket } from '@/constants/ipadHomeNav';
import {
  FEED_BADGE_PX,
  FEED_BODY_PX,
} from '@/constants/feedTypography';
import { COMFORT_GAP_SM } from '@/constants/comfortDensity';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
} from '@/constants/screenLayout';
import { getSegmentTabBarStyles } from '@/constants/segmentTabBar';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { useSignalDatePickerSheet } from '@/hooks/useSignalDatePickerSheet';
import {
  disclosureMeaningLabelIdsForForms,
  isImportantDisclosureDigest,
} from '@/domain/disclosures';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';
import { disclosureDigestCreatedIso } from '@/domain/digests/createdAt';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import type { AppLocale, MessageId } from '@/locales/messages';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { formatFeedItemTimeLabel, toYmd, utcRangeForLocalYmd } from '@/utils/date';
import { webFlexFill, webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';

const MARKET_LABEL: Record<DisclosureFlowMarket, MessageId> = {
  all: 'disclosuresFilterAll',
  us: 'disclosuresFilterUs',
  kr: 'disclosuresFilterKr',
};

function parseMarketParam(value: unknown): DisclosureFlowMarket {
  const raw = String(Array.isArray(value) ? value[0] : value || '').trim();
  if (raw === 'us' || raw === 'kr') return raw;
  return 'all';
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

function sortDigests(rows: SignalApiDisclosureDigestItem[]): SignalApiDisclosureDigestItem[] {
  return [...rows].sort(
    (a, b) =>
      String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
      (b.count - a.count),
  );
}

export function resolveDisclosureDetailId(item: SignalApiDisclosureDigestItem): string | null {
  const primary = String(item.primaryDisclosureId || '').trim();
  if (primary) return primary;
  const refId = item.sourceRefs.find((ref) => String(ref.id || '').trim())?.id;
  return refId ? String(refId).trim() : null;
}

function disclosureMarketLabel(market: string, locale: 'ko' | 'en' | 'ja'): string {
  const key = String(market || '').trim().toLowerCase();
  if (key === 'kr') return locale === 'ko' ? '한국' : locale === 'ja' ? '韓国' : 'Korea';
  if (key === 'us') return locale === 'ko' ? '미국' : locale === 'ja' ? '米国' : 'US';
  return key ? key.toUpperCase() : 'SIGNAL';
}

function disclosureFlowSourceIconEntries(item: SignalApiDisclosureDigestItem) {
  const provider = String(item.market || '').toLowerCase() === 'kr' ? 'DART' : 'SEC';
  return digestSourceIconEntries(
    item.sourceRefs.map((ref) => ({
      sourceName: ref.symbol || ref.companyName || provider,
      url: ref.url,
    })),
    [provider],
  );
}

type DisclosureFlowContentProps = {
  embedded?: boolean;
  initialDate?: string;
  initialMarket?: DisclosureFlowMarket;
  initialDigestId?: string | null;
  onBack?: () => void;
};

export function DisclosureFlowContent({
  embedded = false,
  initialDate = toYmd(new Date()),
  initialMarket = 'all',
  initialDigestId = null,
  onBack,
}: DisclosureFlowContentProps) {
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const setRouteParams = useSafeSetRouteParams();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const todayYmd = useRollingLocalYmd();
  const isWide = embedded || useTwoPane;
  const [selectedYmd, setSelectedYmd] = useState(initialDate);
  const [market, setMarket] = useState<DisclosureFlowMarket>(initialMarket);
  const [items, setItems] = useState<SignalApiDisclosureDigestItem[]>([]);
  const itemsRef = useRef<SignalApiDisclosureDigestItem[]>([]);
  itemsRef.current = items;
  const [sourcesDigestId, setSourcesDigestId] = useState<string | null>(initialDigestId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ref: scrollRef } = useScrollToTopOnChange([market, selectedYmd], {
    resyncDeps: [items],
  });
  const scrollResetKey = `${market}:${selectedYmd}`;

  useEffect(() => {
    setSelectedYmd(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setMarket(initialMarket);
  }, [initialMarket]);

  useEffect(() => {
    setSourcesDigestId(initialDigestId);
  }, [initialDigestId]);

  const syncRoute = useCallback(
    (next: { market?: DisclosureFlowMarket; date?: string; digestId?: string | null }) => {
      const nextMarket = next.market ?? market;
      const nextDate = next.date ?? selectedYmd;
      const nextDigestId = next.digestId === undefined ? sourcesDigestId : next.digestId;
      setRouteParams({
        market: nextMarket === 'all' ? undefined : nextMarket,
        date: nextDate,
        digestId: nextDigestId || undefined,
      });
    },
    [market, selectedYmd, setRouteParams, sourcesDigestId],
  );

  const onPickMarket = useCallback(
    (key: DisclosureFlowMarket) => {
      if (key === market) return;
      setMarket(key);
      syncRoute({ market: key });
    },
    [market, syncRoute],
  );

  const onPickDate = useCallback(
    (ymd: string) => {
      if (ymd === selectedYmd) return;
      setSelectedYmd(ymd);
      syncRoute({ date: ymd });
    },
    [selectedYmd, syncRoute],
  );

  const openSources = useCallback(
    (id: string) => {
      setSourcesDigestId(id);
      syncRoute({ digestId: id });
    },
    [syncRoute],
  );

  const closeSources = useCallback(() => {
    setSourcesDigestId(null);
    syncRoute({ digestId: null });
  }, [syncRoute]);

  const sourcesDigest = useMemo(
    () => (sourcesDigestId ? items.find((item) => item.id === sourcesDigestId) ?? null : null),
    [items, sourcesDigestId],
  );

  const sourceRows = useMemo(
    () => (sourcesDigest ? disclosureDigestSourceSheetRows(sourcesDigest, locale as AppLocale) : []),
    [locale, sourcesDigest],
  );

  const { openDatePicker, datePickerSheet } = useSignalDatePickerSheet({
    selectedYmd,
    todayYmd,
    onSelectYmd: onPickDate,
  });

  const openDetail = useCallback(
    (item: SignalApiDisclosureDigestItem) => {
      const id = resolveDisclosureDetailId(item);
      if (!id) return;
      router.push(`/disclosures/${encodeURIComponent(id)}` as Href);
    },
    [router],
  );

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
      const page = await fetchSignalDisclosureDigests({
        ...utcRangeForLocalYmd(selectedYmd),
        ...(market !== 'all' ? { market } : {}),
        limit: 80,
        batches: 20,
        locale,
      });
      setItems(sortDigests(page.items));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'disclosureFlowLoadError'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [locale, market, selectedYmd, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <SafeAreaView style={styles.safe} edges={isWide ? [] : ['bottom']}>
      <View style={[styles.pageColumn, isWide && styles.pageColumnWide]}>
        {onBack ? (
          <WideSubpaneHeader title={t('disclosureFlowTitle')} onBack={onBack} />
        ) : null}
        <View style={[styles.topFixed, isWide && styles.topFixedWide]}>
          <SignalDateNavigator
            label={formatDateLabel(selectedYmd, locale)}
            previousA11y={t('insightDatePrevious')}
            nextA11y={t('insightDateNext')}
            labelA11y={t('insightOpenCalendar')}
            todayLabel={t('insightCalendarToday')}
            onPrevious={() => onPickDate(shiftYmd(selectedYmd, -1))}
            onNext={() => onPickDate(shiftYmd(selectedYmd, 1))}
            onPressLabel={openDatePicker}
            onToday={() => onPickDate(todayYmd)}
            showToday={selectedYmd !== todayYmd}
            nextDisabled={selectedYmd >= todayYmd}
            style={styles.dateNavigator}
          />
          <View style={styles.segment}>
            {DISCLOSURE_FLOW_MARKET_ORDER.map((key) => {
              const active = market === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => onPickMarket(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.segBtn, active && styles.segBtnActive]}>
                  <Text style={[styles.segText, active && styles.segTextActive]}>
                    {t(MARKET_LABEL[key])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <WebWheelScrollView
          ref={scrollRef as never}
          scrollResetKey={scrollResetKey}
          contentRevision={items}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            isWide && styles.contentWide,
            { paddingBottom: SCREEN_WIDE_SCROLL_BOTTOM_BASE },
          ]}
          showsVerticalScrollIndicator={false}>
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
            <Text style={styles.empty}>{t('disclosureFlowEmpty')}</Text>
          ) : (
            <View style={styles.issueList}>
              {items.map((item) => {
                const detailId = resolveDisclosureDetailId(item);
                const sourceEntries = disclosureFlowSourceIconEntries(item);
                const trailText = item.symbols.slice(0, 2).join(' · ');
                return (
                  <View key={item.id} style={styles.card}>
                    <HomeDigestFeedRow
                      title={item.title}
                      titleLines={2}
                      timeLabel={formatFeedItemTimeLabel(disclosureDigestCreatedIso(item), locale)}
                      trailText={trailText || null}
                      summary={item.summary}
                      summaryLines={3}
                      sourceEntries={sourceEntries}
                      onPress={detailId ? () => openDetail(item) : undefined}
                      badges={
                        <>
                          <View style={styles.categoryMark}>
                            <Text style={styles.categoryText}>{disclosureMarketLabel(item.market, locale)}</Text>
                          </View>
                          {isImportantDisclosureDigest(item) ? (
                            <View style={[styles.categoryMark, styles.importantMark]}>
                              <Text style={[styles.categoryText, styles.importantMarkText]}>
                                {t('disclosuresImportantBadge')}
                              </Text>
                            </View>
                          ) : null}
                          {disclosureMeaningLabelIdsForForms(item.forms, item.market, 2).map((labelId) => (
                            <View key={`${item.id}-${labelId}`} style={styles.categoryMark}>
                              <Text style={styles.categoryText} numberOfLines={1}>
                                {t(labelId)}
                              </Text>
                            </View>
                          ))}
                        </>
                      }
                    />
                    <View style={styles.footerRow}>
                      <Text style={styles.meta} numberOfLines={1}>
                        {t('disclosuresDigestSummary', {
                          count: String(item.count),
                          symbols: String(item.symbols.length),
                        })}
                      </Text>
                      <Pressable
                        onPress={() => openSources(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('feedDigestSourcesButton')}
                        style={({ pressed }) => [styles.sourceToggle, pressed && styles.pressed]}>
                        <Text style={styles.sourceToggleText}>{t('feedDigestSourcesButton')}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </WebWheelScrollView>
      </View>
    </SafeAreaView>
  );

  return (
    <>
      {body}
      {datePickerSheet}
      <DigestSourcesSheet
        visible={sourcesDigestId != null}
        digestTitle={sourcesDigest?.title ?? ''}
        digestSummary={sourcesDigest?.summary?.trim() || undefined}
        rows={sourceRows}
        onClose={closeSources}
      />
    </>
  );
}

export default function DisclosureFlowScreen() {
  const params = useLocalSearchParams<{ date?: string; market?: string; digestId?: string }>();
  const { useTwoPane } = useResponsiveLayout();
  const { t } = useLocale();
  const initialDate = parseDateParam(params.date);
  const initialMarket = parseMarketParam(params.market);
  const initialDigestId = typeof params.digestId === 'string' ? params.digestId : null;

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="disclosure-flow"
        params={{
          date: initialDate,
          market: initialMarket,
          ...(initialDigestId ? { digestId: initialDigestId } : {}),
        }}
      />
    );
  }

  const content = (
    <DisclosureFlowContent
      embedded={false}
      initialDate={initialDate}
      initialMarket={initialMarket}
      initialDigestId={initialDigestId}
    />
  );

  return (
    <>
      <Stack.Screen options={{ title: t('disclosureFlowTitle') }} />
      {content}
    </>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const segmentTab = getSegmentTabBarStyles(theme, sf);
  const fixedHeader = getScreenFixedHeaderStyles(theme);
  return StyleSheet.create({
    safe: { ...webFlexFill, minHeight: 0, backgroundColor: webShellBackground(theme.bg) },
    pageColumn: {
      ...webFlexFill,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    pageColumnWide: {
      ...wideContentFill,
    },
    topFixed: fixedHeader.strip,
    topFixedWide: fixedHeader.stripWide,
    dateNavigator: {
      width: '100%',
    },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    scroll: { ...webScrollViewportStyle },
    content: {
      width: '100%',
      paddingHorizontal: 16,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
      flexGrow: 1,
    },
    contentWide: {
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP,
    },
    loadingBox: { flex: 1, minHeight: 260, paddingVertical: 56, alignItems: 'center', justifyContent: 'center' },
    errorBox: {
      padding: 12,
      borderRadius: UI_RADIUS_CARD,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    errorText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.danger,
    },
    empty: {
      padding: 18,
      borderRadius: UI_RADIUS_CARD,
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
      paddingLeft: ft.pad(14),
      paddingRight: ft.pad(14),
      paddingVertical: ft.pad(14),
      gap: COMFORT_GAP_SM,
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
    importantMark: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    importantMarkText: {
      color: theme.green,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 2,
    },
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
    pressed: { opacity: 0.75 },
  });
}
