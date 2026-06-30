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
import { webHorizontalCarouselScrollProps } from '@/constants/webLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useWebHorizontalWheelScroll } from '@/hooks/useWebHorizontalWheelScroll';
import type { NewsDigestItem } from '@/domain/news';
import type { AppLocale } from '@/locales/messages';
import { formatRelativeFromIso } from '@/utils/date';

const TAP_MOVE_THRESHOLD = 8;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND_LAYOUT = LayoutAnimation.create(180, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

type DigestCardProps = {
  digest: NewsDigestItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
};

const DigestCard = memo(function DigestCard({
  digest,
  isExpanded,
  onToggle,
  styles,
  theme,
}: DigestCardProps) {
  const { t, locale } = useLocale();
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const summaryText = t('feedDigestSummary', {
    count: String(digest.count),
    sources: String(digest.sources.length),
  });
  const relativeLabel = digest.generatedAt ? formatRelativeFromIso(digest.generatedAt, locale as AppLocale) : '';
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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={digest.title}
      accessibilityState={{ expanded: isExpanded }}
    >
      {digest.aiGenerated || digest.topics.length > 0 ? (
        <View style={styles.badgeRow}>
          {digest.aiGenerated ? (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✦ AI</Text>
            </View>
          ) : null}
          {digest.topics.slice(0, 4).map((topic) => (
            <Text key={topic} style={styles.topicChip} numberOfLines={1}>
              {topic}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
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
          {relativeLabel ? ` · ${relativeLabel}` : ''}
        </Text>
        <FontAwesome name={isExpanded ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textDim} />
      </View>
    </Pressable>
  );
});

type Props = {
  batches: NewsDigestItem[];
};

export function DigestPager({ batches }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const pageWidth = Math.max(0, containerWidth || 0);
  const [pageIndex, setPageIndex] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loopResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const carouselPages = useMemo(() => {
    if (batches.length <= 1) return batches;
    return [batches[batches.length - 1], ...batches, batches[0]];
  }, [batches]);

  useWebHorizontalWheelScroll(scrollRef, batches.length > 1);

  const jumpToVisualPage = useCallback((visualIndex: number) => {
    if (pageWidth <= 0) return;
    const x = pageWidth * visualIndex;
    const reset = () => scrollRef.current?.scrollTo({ x, animated: false });
    reset();
    requestAnimationFrame(reset);
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
    if (pageWidth <= 0 || batches.length <= 1) return;
    jumpToVisualPage(1);
    setPageIndex(0);
    setDotIndex(0);
    setExpandedId(null);
  }, [batches, jumpToVisualPage, pageWidth]);

  const syncPageIndex = useCallback(
    (offsetX: number, resetExpand: boolean) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.max(0, Math.round(offsetX / pageWidth));
      if (batches.length > 1 && rawIndex <= 0) {
        clearScheduledLoopReset();
        const index = batches.length - 1;
        jumpToVisualPage(batches.length);
        setPageIndex(index);
        setDotIndex(index);
        if (resetExpand) setExpandedId(null);
        return;
      }
      if (batches.length > 1 && rawIndex >= batches.length + 1) {
        clearScheduledLoopReset();
        jumpToVisualPage(1);
        setPageIndex(0);
        setDotIndex(0);
        if (resetExpand) setExpandedId(null);
        return;
      }
      clearScheduledLoopReset();
      const index = batches.length > 1
        ? Math.max(0, Math.min(rawIndex - 1, batches.length - 1))
        : Math.max(0, Math.min(rawIndex, batches.length - 1));
      setPageIndex(index);
      setDotIndex(index);
      if (resetExpand) setExpandedId(null);
    },
    [pageWidth, batches.length, jumpToVisualPage, clearScheduledLoopReset],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.max(0, Math.round(e.nativeEvent.contentOffset.x / pageWidth));
      if (batches.length > 1 && rawIndex <= 0) {
        const index = batches.length - 1;
        setDotIndex((prev) => (prev === index ? prev : index));
        scheduleLoopReset(batches.length, index);
        return;
      }
      if (batches.length > 1 && rawIndex >= batches.length + 1) {
        setDotIndex((prev) => (prev === 0 ? prev : 0));
        scheduleLoopReset(1, 0);
        return;
      }
      clearScheduledLoopReset();
      const index = batches.length > 1
        ? Math.max(0, Math.min(rawIndex - 1, batches.length - 1))
        : Math.max(0, Math.min(rawIndex, batches.length - 1));
      setDotIndex((prev) => (prev === index ? prev : index));
    },
    [pageWidth, batches.length, clearScheduledLoopReset, scheduleLoopReset],
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncPageIndex(e.nativeEvent.contentOffset.x, true);
    },
    [syncPageIndex],
  );

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(EXPAND_LAYOUT);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

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
        pageCount={batches.length}
        loop
        footer={
          batches.length > 1 ? (
            <View style={styles.dotsRow}>
              {batches.map((_, i) => (
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
          snapToInterval={pageWidth > 0 ? pageWidth : undefined}
          snapToAlignment="start"
          disableIntervalMomentum
          keyboardShouldPersistTaps="handled">
          {pageWidth > 0 &&
            carouselPages.map((digest, index) => {
              const realIndex = batches.length > 1
                ? index <= 0
                  ? batches.length - 1
                  : index >= batches.length + 1
                    ? 0
                    : index - 1
                : index;
              const isExpanded = expandedId === digest.id && pageIndex === realIndex;
              return (
                <View key={`${digest.id}-${index}`} style={[styles.page, { width: pageWidth }]}>
                  <DigestCard
                    digest={digest}
                    isExpanded={isExpanded}
                    onToggle={toggleExpand}
                    styles={styles}
                    theme={theme}
                  />
                </View>
              );
            })}
        </ScrollView>
      </HorizontalCarouselShell>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    page: {
      gap: 8,
    },
    card: {
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      gap: 6,
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
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
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '800',
      color: theme.textMuted,
    },
    title: {
      fontSize: sf(15),
      lineHeight: sf(21),
      minHeight: sf(21) * 2,
      fontWeight: '900',
      color: theme.text,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    footer: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '700',
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
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.text,
    },
    sourceTitleLink: {
      color: theme.accentBlue,
    },
    sourceName: {
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '600',
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
