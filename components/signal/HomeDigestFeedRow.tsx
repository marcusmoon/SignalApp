import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SourceIconStack, type SourceIconEntry } from '@/components/signal/SourceIconStack';
import {
  FEED_DIGEST_TITLE_PX,
  FEED_META_TIME_PX,
  FEED_META_TRAIL_PX,
  FEED_SIGNAL_PREVIEW_PX,
  FEED_SUMMARY_PX,
} from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  title: string;
  titleLines?: 2 | 3 | 4;
  /** digest: 뉴스 이슈 행 / signal: 홈 마켓 브리핑 미리보기 */
  variant?: 'digest' | 'signal';
  timeLabel?: string | null;
  trailText?: string | null;
  summary?: string | null;
  /** 기본 1줄. 목록 상세 화면 등에서 늘릴 때 사용 */
  summaryLines?: number;
  sourceEntries?: SourceIconEntry[];
  badges?: ReactNode;
  bordered?: boolean;
  /** 출처·시간 메타를 제목 위에 표시 (홈 게시판 등) */
  metaBeforeTitle?: boolean;
  onPress?: () => void;
};

/**
 * 홈 뉴스 플로우·마켓 브리핑 공통 행 레이아웃
 * [badges?] → 제목 → [출처 아이콘 스택 · 보조텍스트 | 시간] → [요약?]
 */
export function HomeDigestFeedRow({
  title,
  titleLines = 2,
  variant = 'digest',
  timeLabel,
  trailText,
  summary,
  summaryLines = 1,
  sourceEntries = [],
  badges,
  bordered = false,
  metaBeforeTitle = false,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, variant),
    [theme, scaleFont, feedTypo, variant],
  );
  const hasFooter = sourceEntries.length > 0 || Boolean(trailText?.trim()) || Boolean(timeLabel?.trim() && timeLabel !== '—');
  const trimmedSummary = summary?.trim() || '';

  const footer = hasFooter ? (
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
  ) : null;

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
      {metaBeforeTitle ? footer : null}
      <Text style={styles.title} numberOfLines={titleLines}>
        {title}
      </Text>
      {!metaBeforeTitle ? footer : null}
      {trimmedSummary && summaryLines > 0 ? (
        <Text style={styles.summary} numberOfLines={summaryLines}>
          {trimmedSummary}
        </Text>
      ) : null}
    </Pressable>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  variant: 'digest' | 'signal',
) {
  const isSignal = variant === 'signal';
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
      fontSize: isSignal ? ft.signalBodyFont(FEED_SIGNAL_PREVIEW_PX) : ft.ff(FEED_DIGEST_TITLE_PX),
      lineHeight: isSignal ? sf(21) : sf(18),
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
      fontSize: ft.ff(FEED_META_TRAIL_PX),
      lineHeight: sf(12),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    timeText: {
      flexShrink: 0,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    summary: {
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(15),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
