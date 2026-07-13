import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SourceIconStack, type SourceIconEntry } from '@/components/signal/SourceIconStack';
import { cardListRowSeparatorStyle } from '@/components/signal/groupedFeedList';
import {
  FEED_DIGEST_TITLE_PX,
  FEED_META_TIME_PX,
  FEED_SIGNAL_PREVIEW_PX,
  FEED_SUMMARY_PX,
} from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  title: string;
  titleLines?: 2 | 3 | 4;
  /** digest: 뉴스 흐름 행 / signal: 홈 마켓 브리핑 미리보기 */
  variant?: 'digest' | 'signal';
  timeLabel?: string | null;
  trailText?: string | null;
  summary?: string | null;
  /** 기본 1줄. 목록 상세 화면 등에서 늘릴 때 사용 */
  summaryLines?: number;
  sourceEntries?: SourceIconEntry[];
  badges?: ReactNode;
  bordered?: boolean;
  /** 푸터 왼쪽 커스텀 영역 (홈 게시판 출처 아이콘+이름 등) */
  footerLead?: ReactNode;
  onPress?: () => void;
};

/**
 * 홈 뉴스 플로우·마켓 브리핑 공통 행 레이아웃
 * [badges?] → 제목 → [요약?] → [출처 아이콘 스택 · 보조텍스트 | 시간]
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
  footerLead,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, variant),
    [theme, scaleFont, feedTypo, variant],
  );
  const hasFooter =
    Boolean(footerLead) ||
    sourceEntries.length > 0 ||
    Boolean(trailText?.trim()) ||
    Boolean(timeLabel?.trim() && timeLabel !== '—');
  const trimmedSummary = summary?.trim() || '';

  const footer = hasFooter ? (
    <View style={styles.footer}>
      <View style={styles.footerLead}>
        {footerLead}
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
      <Text style={styles.title} numberOfLines={titleLines}>
        {title}
      </Text>
      {trimmedSummary && summaryLines > 0 ? (
        <Text style={styles.summary} numberOfLines={summaryLines}>
          {trimmedSummary}
        </Text>
      ) : null}
      {footer}
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
  const metaSize = ft.ff(FEED_META_TIME_PX);
  return StyleSheet.create({
    row: {
      gap: 4,
      paddingVertical: 7,
    },
    rowBordered: cardListRowSeparatorStyle(theme),
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
      lineHeight: isSignal ? sf(22) : sf(20),
      fontWeight: isSignal ? ft.signalTitleWeight : ft.titleWeight,
      color: theme.text,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minWidth: 0,
      marginTop: 2,
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
      fontSize: metaSize,
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    timeText: {
      flexShrink: 0,
      fontSize: metaSize,
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    summary: {
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(16),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
