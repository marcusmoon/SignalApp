import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutAnimation,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { HorizontalCarouselShell } from '@/components/layout/HorizontalCarouselShell';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import { webHorizontalCarouselScrollProps } from '@/constants/webLayout';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useWebHorizontalWheelScroll, snapWebCarouselToOffset } from '@/hooks/useWebHorizontalWheelScroll';
import type { NewsDigestItem } from '@/domain/news';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

const TAP_MOVE_THRESHOLD = 8;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND_LAYOUT = LayoutAnimation.create(180, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

function runAfterFrame(callback: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }
  setTimeout(callback, 0);
}

type DigestCardProps = {
  digest: NewsDigestItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  pairLayout?: boolean;
};

const DigestCard = memo(function DigestCard({
  digest,
  isExpanded,
  onToggle,
  styles,
  theme,
  pairLayout = false,
}: DigestCardProps) {
  const { t, locale } = useLocale();
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const summaryText = t('feedDigestSummary', {
    count: String(digest.count),
    sources: String(digest.sources.length),
  });
  const createdLabel = formatFeedItemTimeLabel(newsDigestCreatedIso(digest), locale as AppLocale);
  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    pressStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  }, []);
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const start = pressStartRef.current;
      pressStartRef.current = null;
      if (start) {
        const dx = Math.abs(event.nativeEvent.pageX - start.x);
        const dy = Math.abs(event.nativeEvent.pageY - start.y);
        if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) return;
      }
      onToggle(digest.id);
    },
    [digest.id, onToggle],
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      style={({ pressed }) => [
        styles.card,
        pairLayout && styles.cardPair,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={digest.title}
      accessibilityState={{ expanded: isExpanded }}
    >
      <View style={[styles.accentLine, pairLayout && styles.accentLinePair]} />
      {digest.aiGenerated || digest.topics.length > 0 ? (
        <View style={styles.badgeRow}>
          {digest.aiGenerated ? (
            <View style={[styles.aiBadge, pairLayout && styles.aiBadgePair]}>
              <Text style={styles.aiBadgeText}>✦ AI</Text>
            </View>
          ) : null}
          {digest.topics.slice(0, pairLayout ? 2 : 4).map((topic) => (
            <Text key={topic} style={styles.topicChip} numberOfLines={1}>
              {topic}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={[styles.title, pairLayout && styles.titlePair]} numberOfLines={2}>
        {digest.title}
      </Text>

      {isExpanded && (digest.sourceRefs.length > 0 || digest.sources.length > 0) ? (
        <View style={styles.sourceList}>
          {digest.sourceRefs.length > 0
            ? digest.sourceRefs.slice(0, 5).map((ref, i) => {
                const refUrl = ref.url || undefined;
                return (
                <Pressable
                  key={i}
                  onPress={
                    refUrl
                      ? (e) => {
                          e.stopPropagation?.();
                          void Linking.openURL(refUrl).catch(() => null);
                        }
                      : undefined
                  }
                  style={({ pressed }) => [styles.sourceRow, pressed && refUrl && styles.sourceRowPressed]}
                  accessibilityRole={refUrl ? 'link' : 'text'}
                >
                  <View style={styles.sourceTextCol}>
                    <Text
                      style={[styles.sourceTitle, refUrl && styles.sourceTitleLink]}
                      numberOfLines={2}
                    >
                      {ref.title || ref.sourceName || refUrl || ''}
                    </Text>
                    {ref.sourceName ? (
                      <Text style={styles.sourceName} numberOfLines={1}>
                        {ref.sourceName}
                      </Text>
                    ) : null}
                  </View>
                  {refUrl ? (
                    <FontAwesome name="external-link" size={10} color={theme.accentBlue} />
                  ) : null}
                </Pressable>
                );
              })
            : digest.sources.slice(0, 5).map((src, i) => (
                <View key={i} style={styles.sourceRow}>
                  <Text style={styles.sourceName} numberOfLines={1}>
                    {src}
                  </Text>
                </View>
              ))}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>
          {summaryText}
          {createdLabel !== '—' ? ` · ${createdLabel}` : ''}
        </Text>
        <FontAwesome name={isExpanded ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textDim} />
      </View>
    </Pressable>
  );
});

type Props = {
  batches: NewsDigestItem[];
  /** iPad·wide 웹 등 넓은 화면에서 한 페이지에 2장씩 표시 */
  columns?: 1 | 2;
};

function chunkDigests(items: NewsDigestItem[], columns: 1 | 2): NewsDigestItem[][] {
  if (columns === 1) return items.map((item) => [item]);
  const pages: NewsDigestItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pages.push(items.slice(i, i + 2));
  }
  return pages;
}

export function DigestPager({ batches, columns = 1 }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const pairLayout = columns === 2;
  const isWebCarousel = Platform.OS === 'web';
  const loopCarousel = !isWebCarousel;
  const scrollRef = useRef<ScrollView | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const pageWidth = Math.max(0, containerWidth || 0);
  const [pageIndex, setPageIndex] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loopResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, pairLayout),
    [theme, scaleFont, feedTypo, pairLayout],
  );
  const digestPages = useMemo(() => chunkDigests(batches, columns), [batches, columns]);
  const pageCount = digestPages.length;
  const carouselPages = useMemo(() => {
    if (!loopCarousel || pageCount <= 1) return digestPages;
    return [digestPages[pageCount - 1], ...digestPages, digestPages[0]];
  }, [digestPages, loopCarousel, pageCount]);

  useWebHorizontalWheelScroll(scrollRef, pageCount > 1, pageWidth);

  const jumpToVisualPage = useCallback((visualIndex: number) => {
    if (pageWidth <= 0) return;
    const x = pageWidth * visualIndex;
    const reset = () => scrollRef.current?.scrollTo({ x, animated: false });
    reset();
    runAfterFrame(reset);
    setTimeout(reset, 50);
    setTimeout(reset, 150);
  }, [pageWidth]);

  const clearScheduledLoopReset = useCallback(() => {
    if (!loopResetTimerRef.current) return;
    clearTimeout(loopResetTimerRef.current);
    loopResetTimerRef.current = null;
  }, []);

  const scheduleLoopReset = useCallback(
    (visualIndex: number, logicalIndex: number) => {
      clearScheduledLoopReset();
      loopResetTimerRef.current = setTimeout(() => {
        jumpToVisualPage(visualIndex);
        setPageIndex(logicalIndex);
        setDotIndex(logicalIndex);
        setExpandedId(null);
        loopResetTimerRef.current = null;
      }, 90);
    },
    [clearScheduledLoopReset, jumpToVisualPage],
  );

  useEffect(() => () => clearScheduledLoopReset(), [clearScheduledLoopReset]);

  useEffect(() => {
    if (pageWidth <= 0 || pageCount <= 1) return;
    jumpToVisualPage(loopCarousel ? 1 : 0);
    setPageIndex(0);
    setDotIndex(0);
    setExpandedId(null);
  }, [digestPages, jumpToVisualPage, loopCarousel, pageCount, pageWidth]);

  const syncPageIndex = useCallback(
    (offsetX: number, resetExpand: boolean) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.max(0, Math.round(offsetX / pageWidth));
      if (loopCarousel && pageCount > 1 && rawIndex <= 0) {
        clearScheduledLoopReset();
        const index = pageCount - 1;
        jumpToVisualPage(pageCount);
        setPageIndex(index);
        setDotIndex(index);
        if (resetExpand) setExpandedId(null);
        return;
      }
      if (loopCarousel && pageCount > 1 && rawIndex >= pageCount + 1) {
        clearScheduledLoopReset();
        jumpToVisualPage(1);
        setPageIndex(0);
        setDotIndex(0);
        if (resetExpand) setExpandedId(null);
        return;
      }
      clearScheduledLoopReset();
      const index = loopCarousel && pageCount > 1
        ? Math.max(0, Math.min(rawIndex - 1, pageCount - 1))
        : Math.max(0, Math.min(rawIndex, pageCount - 1));
      setPageIndex(index);
      setDotIndex(index);
      if (resetExpand) setExpandedId(null);
    },
    [pageWidth, pageCount, loopCarousel, jumpToVisualPage, clearScheduledLoopReset],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.max(0, Math.round(e.nativeEvent.contentOffset.x / pageWidth));
      if (loopCarousel && pageCount > 1 && rawIndex <= 0) {
        const index = pageCount - 1;
        setDotIndex((prev) => (prev === index ? prev : index));
        scheduleLoopReset(pageCount, index);
        return;
      }
      if (loopCarousel && pageCount > 1 && rawIndex >= pageCount + 1) {
        setDotIndex((prev) => (prev === 0 ? prev : 0));
        scheduleLoopReset(1, 0);
        return;
      }
      clearScheduledLoopReset();
      const index = loopCarousel && pageCount > 1
        ? Math.max(0, Math.min(rawIndex - 1, pageCount - 1))
        : Math.max(0, Math.min(rawIndex, pageCount - 1));
      setDotIndex((prev) => (prev === index ? prev : index));
    },
    [pageWidth, pageCount, loopCarousel, clearScheduledLoopReset, scheduleLoopReset],
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      if (isWebCarousel && pageWidth > 0) {
        const snappedX = snapWebCarouselToOffset(scrollRef, offsetX, pageWidth, true);
        syncPageIndex(snappedX, true);
        return;
      }
      syncPageIndex(offsetX, true);
    },
    [isWebCarousel, pageWidth, syncPageIndex],
  );

  const toggleExpand = useCallback((id: string) => {
    if (!pairLayout) {
      LayoutAnimation.configureNext(EXPAND_LAYOUT);
    }
    setExpandedId((prev) => (prev === id ? null : id));
  }, [pairLayout]);

  if (batches.length === 0) return null;

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const next = Math.max(0, Math.round(event.nativeEvent.layout.width));
        setContainerWidth((prev) => (prev === next ? prev : next));
      }}>
      <HorizontalCarouselShell
        pageIndex={pageIndex}
        pageCount={pageCount}
        loop={loopCarousel}
        footer={
          pageCount > 1 ? (
            <View style={styles.dotsRow}>
              {digestPages.map((_, i) => (
                <View key={i} style={[styles.dot, i === dotIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null
        }>
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          {...webHorizontalCarouselScrollProps}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          directionalLockEnabled
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.9}
          snapToInterval={!isWebCarousel && pageWidth > 0 ? pageWidth : undefined}
          snapToAlignment="start"
          disableIntervalMomentum={!isWebCarousel}
          keyboardShouldPersistTaps="handled">
          {pageWidth > 0 &&
            carouselPages.map((pageItems, index) => {
              const realIndex = loopCarousel && pageCount > 1
                ? index <= 0
                  ? pageCount - 1
                  : index >= pageCount + 1
                    ? 0
                    : index - 1
                : index;
              return (
                <View
                  key={`${pageItems.map((item) => item.id).join('-')}-${index}`}
                  {...(isWebCarousel
                    ? { dataSet: { signalHorizontalCarouselPage: 'true' } }
                    : {})}
                  style={[
                    styles.page,
                    pairLayout && styles.pageTwoUp,
                    { width: pageWidth },
                  ]}>
                  {pageItems.map((digest) => {
                    const isExpanded = expandedId === digest.id && pageIndex === realIndex;
                    const columnStyle = pairLayout
                      ? pageItems.length === 1
                        ? styles.pageColumnSingle
                        : styles.pageColumn
                      : undefined;
                    return (
                      <View key={digest.id} style={columnStyle}>
                        <DigestCard
                          digest={digest}
                          isExpanded={isExpanded}
                          onToggle={toggleExpand}
                          styles={styles}
                          theme={theme}
                          pairLayout={pairLayout}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
        </ScrollView>
      </HorizontalCarouselShell>
    </View>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  pairLayout: boolean,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    page: {
      gap: 8,
    },
    pageTwoUp: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    pageColumn: {
      flex: 1,
      minWidth: 0,
    },
    pageColumnSingle: {
      width: '48%',
      maxWidth: '48%',
    },
    card: {
      paddingLeft: 18,
      paddingRight: ft.pad(13),
      paddingVertical: ft.pad(11),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      gap: 6,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    cardPair: {
      paddingLeft: 14,
      paddingRight: ft.pad(11),
      paddingVertical: ft.pad(9),
      borderRadius: 12,
      gap: 5,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    accentLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: CONTENT_ACCENT_LINE_WIDTH,
      backgroundColor: theme.green,
    },
    accentLinePair: {
      opacity: 0.45,
    },
    cardPressed: {
      opacity: 0.88,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      alignItems: 'center',
    },
    aiBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.accentBlue,
      borderWidth: 1,
      borderColor: theme.accentBlue,
    },
    aiBadgePair: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    aiBadgeText: {
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '900',
      color: '#FFFFFF',
    },
    topicChip: {
      overflow: 'hidden',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: ft.ff(10),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
    },
    title: {
      fontSize: ft.ff(15),
      lineHeight: ft.ff(21),
      minHeight: ft.ff(21) * 2,
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    titlePair: {
      fontSize: ft.ff(14),
      lineHeight: ft.ff(19),
      minHeight: undefined,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    footer: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      flex: 1,
    },
    sourceList: {
      gap: 6,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    sourceRowPressed: {
      opacity: 0.7,
    },
    sourceTextCol: {
      flex: 1,
      gap: 1,
    },
    sourceTitle: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(17),
      fontWeight: ft.bodyWeight,
      color: theme.text,
    },
    sourceTitleLink: {
      color: theme.accentBlue,
    },
    sourceName: {
      fontSize: ft.ff(10),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 14,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.green,
    },
  });
}
