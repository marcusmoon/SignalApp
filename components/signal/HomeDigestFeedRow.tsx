import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SourceIconStack, type SourceIconEntry } from '@/components/signal/SourceIconStack';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  title: string;
  titleLines?: 2 | 3;
  timeLabel?: string | null;
  trailText?: string | null;
  summary?: string | null;
  sourceEntries?: SourceIconEntry[];
  badges?: ReactNode;
  bordered?: boolean;
  onPress?: () => void;
};

/**
 * 홈 뉴스 플로우·마켓 브리핑 공통 행 레이아웃
 * [badges?] → 제목 → [출처 아이콘 스택 · 보조텍스트 | 시간] → [요약?]
 */
export function HomeDigestFeedRow({
  title,
  titleLines = 2,
  timeLabel,
  trailText,
  summary,
  sourceEntries = [],
  badges,
  bordered = false,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const hasFooter = sourceEntries.length > 0 || Boolean(trailText?.trim()) || Boolean(timeLabel?.trim() && timeLabel !== '—');
  const trimmedSummary = summary?.trim() || '';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        bordered && styles.rowBordered,
        onPress && pressed && styles.rowPressed,
      ]}>
      {badges ? <View style={styles.badgeRow}>{badges}</View> : null}
      <Text style={styles.title} numberOfLines={titleLines}>
        {title}
      </Text>
      {hasFooter ? (
        <View style={styles.footer}>
          <View style={styles.footerLead}>
            {sourceEntries.length > 0 ? (
              <SourceIconStack sources={sourceEntries} size={18} maxVisible={4} />
            ) : null}
            {trailText?.trim() ? (
              <Text style={styles.trailText} numberOfLines={1}>
                {trailText.trim()}
              </Text>
            ) : null}
          </View>
          {timeLabel && timeLabel !== '—' ? (
            <Text style={styles.timeText} numberOfLines={1}>
              {timeLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
      {trimmedSummary ? (
        <Text style={styles.summary} numberOfLines={1}>
          {trimmedSummary}
        </Text>
      ) : null}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    row: {
      gap: 3,
      paddingVertical: 5,
    },
    rowBordered: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowPressed: {
      opacity: 0.88,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
      minWidth: 0,
    },
    title: {
      fontSize: ft.ff(14),
      lineHeight: sf(18),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minWidth: 0,
    },
    footerLead: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trailText: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(9),
      lineHeight: sf(12),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    timeText: {
      flexShrink: 0,
      fontSize: ft.ff(10),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    summary: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
