import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FEED_BADGE_PX } from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type HomeSectionHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  trailingBadge?: ReactNode;
  /** 섹션 타이틀 행 우측 끝 메타 — 세션 태그와 동일 칩 스타일 */
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
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
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
        <View style={styles.metaChip} accessibilityRole="text">
          <Text style={styles.metaChipText} numberOfLines={1}>
            {metaLabel}
          </Text>
        </View>
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

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
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
    /** BriefingSessionTag 와 동일 톤 */
    metaChip: {
      flexShrink: 0,
      maxWidth: '42%',
      alignSelf: 'center',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    metaChipText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      textAlign: 'right',
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
