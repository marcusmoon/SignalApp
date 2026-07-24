import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import type { AppLocale } from '@/locales/messages';
import { addDays, toYmd } from '@/utils/date';

export type InvestMonthCalendarProps = {
  year: number;
  /** 0–11 */
  month: number;
  selectedYmd: string;
  eventDates: Set<string>;
  onSelectYmd: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  monthPrevA11y: string;
  monthNextA11y: string;
  /** 오늘 날짜 YYYY-MM-DD (부모에서 한 번만 계산) */
  todayYmd: string;
  /** 선택 가능한 마지막 날짜 YYYY-MM-DD */
  maxYmd?: string;
  theme: AppTheme;
  locale: AppLocale;
  /** 상단 고정 등 좁은 영역용 — 패딩·셀 높이 축소 */
  compact?: boolean;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 월 첫날이 월요일 시작 그리드에서 몇 칸 비어야 하는지 (0–6) */
function leadingBlankCount(year: number, month: number): number {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  return (dow + 6) % 7;
}

export function InvestMonthCalendar({
  year,
  month,
  selectedYmd,
  eventDates,
  onSelectYmd,
  onPrevMonth,
  onNextMonth,
  monthPrevA11y,
  monthNextA11y,
  todayYmd,
  maxYmd,
  theme,
  locale,
  compact = false,
}: InvestMonthCalendarProps) {
  const weekdayLabels = useMemo(() => {
    const loc = locale === 'ja' ? 'ja-JP' : locale === 'en' ? 'en-US' : 'ko-KR';
    const fmt = new Intl.DateTimeFormat(loc, { weekday: 'short' });
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(monday, i)));
  }, [locale]);

  const monthTitle = useMemo(() => {
    const loc = locale === 'ja' ? 'ja-JP' : locale === 'en' ? 'en-US' : 'ko-KR';
    return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  }, [year, month, locale]);

  const cells = useMemo(() => {
    const lead = leadingBlankCount(year, month);
    const dim = daysInMonth(year, month);
    const out: { ymd: string | null; inMonth: boolean }[] = [];
    for (let i = 0; i < lead; i++) {
      out.push({ ymd: null, inMonth: false });
    }
    for (let d = 1; d <= dim; d++) {
      out.push({ ymd: toYmd(new Date(year, month, d)), inMonth: true });
    }
    while (out.length % 7 !== 0) {
      out.push({ ymd: null, inMonth: false });
    }
    return out;
  }, [year, month]);

  const styles = useMemo(() => makeStyles(theme, compact), [theme, compact]);

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <Pressable
          onPress={onPrevMonth}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={monthPrevA11y}
          hitSlop={10}>
          <FontAwesome name="chevron-left" size={compact ? 12 : 16} color={theme.green} />
        </Pressable>
        <Text style={styles.monthTitle} numberOfLines={1} pointerEvents="none">
          {monthTitle}
        </Text>
        <Pressable
          onPress={onNextMonth}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={monthNextA11y}
          hitSlop={10}>
          <FontAwesome name="chevron-right" size={compact ? 12 : 16} color={theme.green} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {weekdayLabels.map((label, i) => (
          <Text key={i} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell.ymd) {
            return <View key={`e-${idx}`} style={styles.cell} />;
          }
          const isToday = cell.ymd === todayYmd;
          const isSelected = cell.ymd === selectedYmd;
          const hasDot = eventDates.has(cell.ymd);
          const disabled = Boolean(maxYmd && cell.ymd > maxYmd);
          const dayNum = Number(cell.ymd.slice(8, 10));
          return (
            <Pressable
              key={cell.ymd}
              onPress={() => onSelectYmd(cell.ymd!)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.cell,
                isSelected && styles.cellSelected,
                disabled && styles.cellDisabled,
                pressed && !disabled && styles.cellPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={cell.ymd}>
              <View style={styles.cellInner}>
                <Text
                  style={[
                    styles.dayNum,
                    isSelected && styles.dayNumSelected,
                    isToday && !isSelected && styles.dayNumToday,
                    disabled && styles.dayNumDisabled,
                  ]}>
                  {dayNum}
                </Text>
                {hasDot ? (
                  <View style={[styles.dot, isSelected && styles.dotOnSelected]} />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
                {isToday ? (
                  <View style={[styles.todayMarker, isSelected && styles.todayMarkerOnSelected]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, compact: boolean) {
  return StyleSheet.create({
    wrap: {
      marginBottom: compact ? 0 : 16,
      borderRadius: compact ? 10 : 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: compact ? 6 : 12,
      paddingVertical: compact ? 6 : 12,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 4 : 6,
      marginBottom: compact ? 4 : 12,
    },
    navBtn: {
      width: compact ? 28 : 36,
      height: compact ? 28 : 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthTitle: {
      fontSize: compact ? 13 : 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      textAlign: 'center',
      minWidth: 0,
    },
    weekRow: { flexDirection: 'row', marginBottom: compact ? 2 : 6 },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: compact ? 10 : 11,
      fontWeight: '700',
      color: theme.textMuted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: '14.28%',
      minHeight: compact ? 30 : 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: compact ? 2 : 4,
    },
    cellInner: {
      minWidth: compact ? 26 : 32,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: compact ? 2 : 3,
    },
    cellSelected: {
      backgroundColor: theme.green,
      borderRadius: 999,
    },
    cellPressed: { opacity: 0.85 },
    cellDisabled: { opacity: 0.32 },
    dayNum: { fontSize: compact ? 12 : 14, fontWeight: '700', color: theme.text },
    dayNumSelected: { color: '#FFFFFF', fontWeight: '600' },
    dayNumToday: { fontWeight: '700', color: theme.text },
    dayNumDisabled: { color: theme.textDim },
    todayMarker: {
      position: 'absolute',
      bottom: 0,
      width: compact ? 12 : 14,
      height: compact ? 2 : 3,
      borderRadius: 2,
      backgroundColor: theme.accentBlue,
    },
    todayMarkerOnSelected: {
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    dot: {
      width: compact ? 5 : 6,
      height: compact ? 5 : 6,
      borderRadius: compact ? 2.5 : 3,
      backgroundColor: theme.accentBlue,
      marginTop: compact ? 2 : 3,
    },
    dotOnSelected: { backgroundColor: '#FFFFFF' },
    dotPlaceholder: { height: compact ? 7 : 9, marginTop: compact ? 2 : 3 },
  });
}
