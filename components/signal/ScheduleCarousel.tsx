import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { CalendarEvent } from '@/types/signal';

type Props = {
  events: CalendarEvent[];
  emptyText: string;
  onPress: () => void;
};

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

function formatShortDate(value: string | null | undefined, locale: 'ko' | 'en' | 'ja'): string {
  if (!value) return '-';
  const date = value.length <= 10 ? parseYmd(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat(localeForDate(locale), {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    }).format(date);
  } catch {
    return String(value).slice(0, 10);
  }
}

function calendarTypeLabelId(type: CalendarEvent['type']) {
  if (type === 'earnings') return 'calendarTagEarnings';
  if (type === 'fed') return 'calendarTagFed';
  if (type === 'fomc') return 'calendarTagFomc';
  if (type === 'holiday') return 'calendarTagHoliday';
  return 'calendarTagMacro';
}

export function ScheduleCarousel({ events, emptyText, onPress }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const pageWidth = Math.max(0, containerWidth);

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(0, events.length - 1)));
  }, [events.length]);

  const syncPageIndex = useCallback(
    (offsetX: number) => {
      if (pageWidth <= 0 || events.length <= 0) return;
      const next = Math.max(0, Math.min(Math.round(offsetX / pageWidth), events.length - 1));
      setPageIndex((prev) => (prev === next ? prev : next));
    },
    [events.length, pageWidth],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncPageIndex(event.nativeEvent.contentOffset.x);
    },
    [syncPageIndex],
  );

  if (events.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const next = Math.max(0, Math.round(event.nativeEvent.layout.width));
        setContainerWidth((prev) => (prev === next ? prev : next));
      }}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        snapToInterval={pageWidth > 0 ? pageWidth : undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        directionalLockEnabled
        keyboardShouldPersistTaps="handled">
        {pageWidth > 0
          ? events.map((event) => (
              <View key={event.id} style={[styles.page, { width: pageWidth }]}>
                <Pressable
                  onPress={onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.dateBadge}>{formatShortDate(event.date, locale)}</Text>
                    <Text style={styles.typeBadge}>{t(calendarTypeLabelId(event.type))}</Text>
                    {event.symbol ? <Text style={styles.symbolBadge}>{event.symbol}</Text> : null}
                  </View>
                  <Text style={styles.title} numberOfLines={3}>
                    {event.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[event.time, event.country].filter(Boolean).join(' · ') || '-'}
                    </Text>
                    <FontAwesome name="chevron-right" size={11} color={theme.textDim} />
                  </View>
                </Pressable>
              </View>
            ))
          : null}
      </ScrollView>

      <View style={styles.navigator}>
        <View style={styles.dotsRow}>
          {events.map((event, index) => (
            <View key={event.id} style={[styles.dot, index === pageIndex && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.counter}>
          {pageIndex + 1} / {events.length}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    container: {
      gap: 10,
    },
    page: {
      paddingHorizontal: 1,
    },
    card: {
      minHeight: 132,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 12,
      justifyContent: 'space-between',
    },
    pressed: {
      opacity: 0.82,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    dateBadge: {
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.green,
    },
    typeBadge: {
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
      color: theme.textMuted,
    },
    symbolBadge: {
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: theme.warningDim,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.warning,
    },
    title: {
      fontSize: sf(16),
      lineHeight: sf(22),
      fontWeight: '900',
      color: theme.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    meta: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.textMuted,
    },
    navigator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    dotsRow: {
      flexDirection: 'row',
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
      width: 16,
      backgroundColor: theme.green,
    },
    counter: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
      color: theme.textMuted,
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    emptyText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textMuted,
    },
  });
}
