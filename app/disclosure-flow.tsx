import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeSectionAccentLine } from '@/components/signal/HomeSectionAccentLine';
import { AccountSubpaneHeader } from '@/components/account/AccountSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { DISCLOSURE_FLOW_MARKET_ORDER, type DisclosureFlowMarket } from '@/constants/ipadHomeNav';
import {
  FEED_BADGE_PX,
  FEED_BODY_PX,
  FEED_DETAIL_TITLE_PX,
  FEED_META_TIME_PX,
  FEED_PREVIEW_BODY_PX,
  FEED_SUMMARY_PX,
} from '@/constants/feedTypography';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_HEADER_CONTENT_GAP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { useSignalDatePickerSheet } from '@/hooks/useSignalDatePickerSheet';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';
import { disclosureDigestCreatedIso } from '@/domain/digests/createdAt';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import type { MessageId } from '@/locales/messages';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { formatFeedItemTimeLabel, toYmd, utcRangeForLocalYmd } from '@/utils/date';

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
  const [highlightId, setHighlightId] = useState<string | null>(initialDigestId);
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
    setHighlightId(initialDigestId);
  }, [initialDigestId]);

  const syncRoute = useCallback(
    (next: { market?: DisclosureFlowMarket; date?: string; digestId?: string | null }) => {
      const nextMarket = next.market ?? market;
      const nextDate = next.date ?? selectedYmd;
      const nextDigestId = next.digestId === undefined ? highlightId : next.digestId;
      setRouteParams({
        market: nextMarket === 'all' ? undefined : nextMarket,
        date: nextDate,
        digestId: nextDigestId || undefined,
      });
    },
    [highlightId, market, selectedYmd, setRouteParams],
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

  return (
    <>
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
            <AccountSubpaneHeader title={t('disclosureFlowTitle')} onBack={onBack} />
          ) : null}

          <View style={styles.header}>
            <View style={styles.categoryTabs}>
              {DISCLOSURE_FLOW_MARKET_ORDER.map((key) => {
                const active = market === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => onPickMarket(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.categoryTab, active && styles.categoryTabActive]}>
                    <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                      {t(MARKET_LABEL[key])}
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
            <Text style={styles.empty}>{t('disclosureFlowEmpty')}</Text>
          ) : (
            <View style={styles.issueList}>
              {items.map((item) => {
                const highlighted = highlightId === item.id;
                const detailId = resolveDisclosureDetailId(item);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openDetail(item)}
                    disabled={!detailId}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.card,
                      highlighted && styles.cardHighlighted,
                      pressed && detailId && styles.pressed,
                    ]}>
                    <HomeSectionAccentLine section="disclosure" style={styles.cardAccent} />
                    <View style={styles.badgeRow}>
                      <Text style={styles.marketChip}>{disclosureMarketLabel(item.market, locale)}</Text>
                      {item.forms.slice(0, 2).map((form) => (
                        <Text key={`${item.id}-${form}`} style={styles.formChip} numberOfLines={1}>
                          {form}
                        </Text>
                      ))}
                      {item.symbols.slice(0, 3).map((symbol) => (
                        <Text key={`${item.id}-${symbol}`} style={[styles.formChip, styles.symbolChip]} numberOfLines={1}>
                          {symbol}
                        </Text>
                      ))}
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.createdAt}>
                      {formatFeedItemTimeLabel(disclosureDigestCreatedIso(item), locale)}
                    </Text>
                    {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
                    <Text style={styles.meta} numberOfLines={1}>
                      {t('disclosuresDigestSummary', {
                        count: String(item.count),
                        symbols: String(item.symbols.length),
                      })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </WebWheelScrollView>
    </SafeAreaView>
    {datePickerSheet}
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
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingLeft: 18,
      paddingRight: ft.pad(14),
      paddingVertical: ft.pad(14),
      gap: 16,
    },
    cardHighlighted: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    cardAccent: {
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    marketChip: {
      overflow: 'hidden',
      minHeight: 20,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    formChip: {
      overflow: 'hidden',
      maxWidth: 120,
      minHeight: 20,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    symbolChip: {
      color: theme.green,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    cardTitle: {
      color: theme.text,
      fontSize: ft.ff(FEED_DETAIL_TITLE_PX),
      lineHeight: sf(24),
      fontWeight: ft.titleWeight,
    },
    createdAt: {
      color: theme.textDim,
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
    },
    summary: {
      color: theme.textMuted,
      fontSize: ft.ff(FEED_PREVIEW_BODY_PX),
      lineHeight: sf(20),
      fontWeight: ft.bodyWeight,
    },
    meta: {
      color: theme.textDim,
      fontSize: ft.ff(FEED_BODY_PX),
      fontWeight: ft.metaWeight,
    },
    pressed: { opacity: 0.75 },
  });
}
