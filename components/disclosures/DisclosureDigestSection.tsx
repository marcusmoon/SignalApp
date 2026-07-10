/**
 * 공시 탭 상단 - 뉴스 주요 이슈(DigestPager)와 동일한 레이아웃
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
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
import { CONTENT_ACCENT_LINE_WIDTH, homeSectionAccentColor, type HomeAccentSection } from '@/constants/homeSectionAccent';
import { webHorizontalCarouselScrollProps } from '@/constants/webLayout';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useWebHorizontalWheelScroll } from '@/hooks/useWebHorizontalWheelScroll';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { disclosureDigestCreatedIso } from '@/domain/digests/createdAt';
import { formatFeedItemTimeLabel } from '@/utils/date';

const TAP_MOVE_THRESHOLD = 8;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND_LAYOUT = LayoutAnimation.create(180, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

function marketChipLabel(market: string, locale: string): string {
  if (market === 'kr') return locale === 'ko' ? '한국' : locale === 'ja' ? '韓国' : 'Korea';
  return locale === 'ko' ? '미국' : locale === 'ja' ? '米国' : 'US';
}

type DigestCardProps = {
  item: SignalApiDisclosureDigestItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
};

const DigestCard = memo(function DigestCard({
  item,
  isExpanded,
  onToggle,
  styles,
  theme,
}: DigestCardProps) {
  const { t, locale } = useLocale();
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const summaryText = t('disclosuresDigestSummary', {
    count: String(item.count),
    symbols: String(item.symbols.length),
  });
  const createdLabel = formatFeedItemTimeLabel(disclosureDigestCreatedIso(item), locale as AppLocale);
  const topicChips = [
    ...new Set([
      marketChipLabel(item.market, locale),
      ...item.symbols.slice(0, 3),
      ...item.forms.slice(0, 2),
    ]),
  ].filter(Boolean);

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
      onToggle(item.id);
    },
    [item.id, onToggle],
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityState={{ expanded: isExpanded }}>
      <View style={styles.accentLine} />
      {topicChips.length > 0 ? (
        <View style={styles.badgeRow}>
          {topicChips.map((chip, index) => (
            <Text key={`${chip}-${index}`} style={styles.topicChip} numberOfLines={1}>
              {chip}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {isExpanded && item.sourceRefs.length > 0 ? (
        <View style={styles.sourceList}>
          {item.sourceRefs.slice(0, 5).map((ref) => {
            const refUrl = ref.url || undefined;
            return (
              <Pressable
                key={ref.id}
                onPress={
                  refUrl
                    ? (e) => {
                        e.stopPropagation?.();
                        void Linking.openURL(refUrl).catch(() => null);
                      }
                    : undefined
                }
                style={({ pressed }) => [styles.sourceRow, pressed && refUrl && styles.sourceRowPressed]}
                accessibilityRole={refUrl ? 'link' : 'text'}>
                <View style={styles.sourceTextCol}>
                  <Text
                    style={[styles.sourceTitle, refUrl && styles.sourceTitleLink]}
                    numberOfLines={2}>
                    {ref.title || ref.companyName}
                  </Text>
                  {ref.formType || ref.symbol ? (
                    <Text style={styles.sourceName} numberOfLines={1}>
                      {[ref.symbol, ref.formType].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                {refUrl ? <FontAwesome name="external-link" size={10} color={theme.accentBlue} /> : null}
              </Pressable>
            );
          })}
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
  items: SignalApiDisclosureDigestItem[];
  loading?: boolean;
  accentColor?: string;
  accentSection?: HomeAccentSection;
};

export function DisclosureDigestSection({ items, loading, accentColor, accentSection }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const pageWidth = Math.max(0, containerWidth || 0);
  const [pageIndex, setPageIndex] = useState(0);
  const [dotIndex, setDotIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loopItems = useMemo(() => (items.length > 1 ? [...items, items[0]] : items), [items]);
  const resolvedAccent = accentSection ? homeSectionAccentColor(accentSection, theme) : accentColor;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, resolvedAccent),
    [theme, scaleFont, feedTypo, resolvedAccent],
  );

  useWebHorizontalWheelScroll(scrollRef, items.length > 1);

  const resetLoopToStart = useCallback(() => {
    const reset = () => scrollRef.current?.scrollTo({ x: 0, animated: false });
    reset();
    requestAnimationFrame(reset);
    setTimeout(reset, 50);
    setTimeout(reset, 150);
  }, []);

  const syncPageIndex = useCallback(
    (offsetX: number, resetExpand: boolean) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.round(offsetX / pageWidth);
      if (items.length > 1 && rawIndex >= items.length) {
        resetLoopToStart();
        setPageIndex(0);
        setDotIndex(0);
        if (resetExpand) setExpandedId(null);
        return;
      }
      const index = Math.max(0, Math.min(rawIndex, items.length - 1));
      setPageIndex(index);
      setDotIndex(index);
      if (resetExpand) setExpandedId(null);
    },
    [pageWidth, items.length, resetLoopToStart],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const rawIndex = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      const index = items.length > 1 && rawIndex >= items.length ? 0 : Math.max(0, Math.min(rawIndex, items.length - 1));
      setDotIndex((prev) => (prev === index ? prev : index));
    },
    [pageWidth, items.length],
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

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const next = Math.max(0, Math.round(event.nativeEvent.layout.width));
        setContainerWidth((prev) => (prev === next ? prev : next));
      }}>
      <HorizontalCarouselShell
        pageIndex={pageIndex}
        pageCount={items.length}
        loop
        footer={
          items.length > 1 ? (
            <View style={styles.dotsRow}>
              {items.map((_, i) => (
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
            loopItems.map((item, index) => {
              const isLoopClone = index >= items.length;
              const isExpanded = !isLoopClone && expandedId === item.id && pageIndex === index;
              return (
                <View key={`${item.id}-${index}`} style={[styles.page, { width: pageWidth }]}>
                  <DigestCard
                    item={item}
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

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  accentColor?: string,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    page: {
      gap: 8,
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
    accentLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: CONTENT_ACCENT_LINE_WIDTH,
      backgroundColor: accentColor || theme.warning,
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
