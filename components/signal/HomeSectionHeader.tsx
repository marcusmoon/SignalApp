import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type HomeSectionHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  accent?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function HomeSectionHeader({
  title,
  subtitle,
  badge,
  accent,
  onPress,
  accessibilityLabel,
}: HomeSectionHeaderProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const content = (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        {accent ? <View style={[styles.accentDot, { backgroundColor: accent }]} /> : null}
        <View style={styles.titleCol}>
          <View style={styles.titleLine}>
            <Text style={styles.title}>{title}</Text>
            {badge}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {onPress ? <FontAwesome name="chevron-right" size={12} color={theme.textDim} /> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    accentDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      marginTop: 8,
      flexShrink: 0,
    },
    titleCol: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    titleLine: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    subtitle: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textMuted,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
