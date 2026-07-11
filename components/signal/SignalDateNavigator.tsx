import FontAwesome from '@expo/vector-icons/FontAwesome';
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
        style={({ pressed }) => [styles.dateArrow, pressed && styles.dateArrowPressed]}>
        <FontAwesome name="chevron-left" size={13} color={theme.green} />
      </Pressable>
      <Pressable
        onPress={onPressLabel}
        disabled={!onPressLabel}
        accessibilityRole={onPressLabel ? 'button' : undefined}
        accessibilityLabel={labelA11y}
        style={({ pressed }) => [styles.datePickerCenter, pressed && onPressLabel && styles.dateActionBtnPressed]}>
        <View style={styles.dateIconMark}>
          <FontAwesome name="calendar" size={12} color={theme.green} />
        </View>
        <Text style={styles.datePickerValue} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      {showToday && onToday ? (
        <Pressable
          onPress={onToday}
          accessibilityRole="button"
          accessibilityLabel={todayLabel}
          style={({ pressed }) => [styles.dateTodayBtn, pressed && styles.dateActionBtnPressed]}>
          <FontAwesome name="dot-circle-o" size={14} color={theme.green} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        accessibilityRole="button"
        accessibilityLabel={nextA11y}
        hitSlop={8}
        style={({ pressed }) => [
          styles.dateArrow,
          nextDisabled && styles.dateArrowDisabled,
          pressed && !nextDisabled && styles.dateArrowPressed,
        ]}>
        <FontAwesome
          name="chevron-right"
          size={13}
          color={nextDisabled ? theme.textDim : theme.green}
        />
      </Pressable>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const digestBg =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}10` : theme.bgElevated;

  return StyleSheet.create({
    datePicker: {
      padding: 8,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      borderRadius: 8,
      backgroundColor: digestBg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateArrow: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    dateArrowPressed: { opacity: 0.82 },
    dateArrowDisabled: {
      opacity: 0.42,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    datePickerCenter: {
      flex: 1,
      minWidth: 0,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 10,
    },
    dateIconMark: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    datePickerValue: {
      color: theme.text,
      fontSize: sf(14),
      lineHeight: sf(18),
      fontWeight: '900',
      textAlign: 'center',
      flexShrink: 1,
    },
    dateTodayBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateActionBtnPressed: { opacity: 0.86 },
  });
}
