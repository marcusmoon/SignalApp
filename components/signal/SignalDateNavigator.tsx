import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type SignalDateNavigatorProps = {
  label: string;
  previousA11y: string;
  nextA11y: string;
  todayLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  labelA11y?: string;
  onPressLabel?: () => void;
  onToday?: () => void;
  showToday?: boolean;
  nextDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * C1 compact date bar — single outer shell; no nested control boxes.
 * ‹  calendar + date  ›  [오늘]
 */
export function SignalDateNavigator({
  label,
  previousA11y,
  nextA11y,
  todayLabel,
  onPrevious,
  onNext,
  labelA11y,
  onPressLabel,
  onToday,
  showToday = false,
  nextDisabled = false,
  style,
}: SignalDateNavigatorProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View style={[styles.datePicker, style]}>
      <Pressable
        onPress={onPrevious}
        accessibilityRole="button"
        accessibilityLabel={previousA11y}
        hitSlop={8}
        style={({ pressed }) => [styles.dateArrow, pressed && styles.controlPressed]}>
        <Ionicons name="chevron-back" size={18} color={theme.green} />
      </Pressable>
      <Pressable
        onPress={onPressLabel}
        disabled={!onPressLabel}
        accessibilityRole={onPressLabel ? 'button' : undefined}
        accessibilityLabel={labelA11y}
        style={({ pressed }) => [
          styles.datePickerCenter,
          pressed && onPressLabel && styles.controlPressed,
        ]}>
        <Ionicons name="calendar-outline" size={15} color={theme.green} />
        <Text style={styles.datePickerValue} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        accessibilityRole="button"
        accessibilityLabel={nextA11y}
        hitSlop={8}
        style={({ pressed }) => [
          styles.dateArrow,
          nextDisabled && styles.dateArrowDisabled,
          pressed && !nextDisabled && styles.controlPressed,
        ]}>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={nextDisabled ? theme.textDim : theme.green}
        />
      </Pressable>
      {showToday && onToday ? (
        <Pressable
          onPress={onToday}
          accessibilityRole="button"
          accessibilityLabel={todayLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.dateTodayBtn, pressed && styles.controlPressed]}>
          <Text style={styles.dateTodayText}>{todayLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    datePicker: {
      paddingVertical: 6,
      paddingHorizontal: 6,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateArrow: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateArrowDisabled: {
      opacity: 0.42,
    },
    controlPressed: { opacity: 0.72 },
    datePickerCenter: {
      flex: 1,
      minWidth: 0,
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 6,
    },
    datePickerValue: {
      color: theme.text,
      fontSize: sf(14),
      lineHeight: sf(18),
      fontWeight: '700',
      textAlign: 'center',
      flexShrink: 1,
    },
    dateTodayBtn: {
      height: 32,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateTodayText: {
      color: theme.green,
      fontSize: sf(13),
      lineHeight: sf(16),
      fontWeight: '700',
    },
  });
}
