import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type HomeSectionHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  trailingBadge?: ReactNode;
  /** 섹션 타이틀 행 우측 끝 메타 (예: 섹터 흐름 기준 시각) */
  meta?: string | null;
  onPress?: () => void;
  accessibilityLabel?: string;
  showChevron?: boolean;
};

export function HomeSectionHeader({
  title,
  subtitle,
  badge,
  trailingBadge,
  meta,
  onPress,
  accessibilityLabel,
  showChevron = true,
}: HomeSectionHeaderProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const metaLabel = String(meta || '').trim();

  const content = (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <View style={styles.titleLine}>
            {badge}
            <Text style={styles.title}>{title}</Text>
            {trailingBadge}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {metaLabel ? (
        <Text style={styles.meta} numberOfLines={1}>
          {metaLabel}
        </Text>
      ) : null}
      {onPress && showChevron ? <FontAwesome name="chevron-right" size={12} color={theme.textDim} /> : null}
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
      gap: 20,
    },
    titleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    titleCol: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    titleLine: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    title: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      fontSize: sf(16),
      lineHeight: sf(22),
      fontWeight: '700',
      color: theme.text,
    },
    subtitle: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.textMuted,
    },
    meta: {
      flexShrink: 0,
      maxWidth: '42%',
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '600',
      color: theme.textDim,
      textAlign: 'right',
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
