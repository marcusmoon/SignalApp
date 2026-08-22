import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { SourceIconStack, type SourceIconEntry } from '@/components/signal/SourceIconStack';
import { cardListRowSeparatorStyle } from '@/components/signal/groupedFeedList';
import {
  FEED_DIGEST_TITLE_LINE_PX,
  FEED_DIGEST_TITLE_PX,
  FEED_META_TIME_PX,
  FEED_SIGNAL_PREVIEW_PX,
  FEED_SUMMARY_PX,
} from '@/constants/feedTypography';
import {
  HOME_NEWS_META_PX,
  HOME_NEWS_ROW_PAD_V,
  HOME_NEWS_TITLE_LINE_PX,
  HOME_NEWS_TITLE_PX,
} from '@/constants/homeScan';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  title: string;
  /**
   * 제목 줄 수. 생략 시 digest=2, signal(마켓 브리핑)=제한 없음.
   * `null`이면 항상 전체 표시.
   */
  titleLines?: number | null;
  /** digest: 뉴스 흐름 행 / signal: 홈 마켓 브리핑 미리보기 */
  variant?: 'digest' | 'signal';
  /** Home news only — larger title than shared digest lists */
  density?: 'default' | 'home';
  timeLabel?: string | null;
  trailText?: string | null;
  summary?: string | null;
  /** 기본 1줄. `null`이면 전체 표시. `0`이면 숨김 */
  summaryLines?: number | null;
  sourceEntries?: SourceIconEntry[];
  badges?: ReactNode;
  bordered?: boolean;
  /** 푸터 왼쪽 커스텀 영역 (홈 게시판 출처 아이콘+이름 등) */
  footerLead?: ReactNode;
  /** 최근 갱신 항목 여부 (시간 표시 강조) */
  isFresh?: boolean;
  onPress?: () => void;
};

/**
 * 홈 뉴스 플로우·마켓 브리핑 공통 행 레이아웃
 * [badges?] → 제목 → [요약?] → [출처 아이콘 스택 · 보조텍스트 | (최신) 시간]
 * 최근 갱신은 제목 위 뱃지가 아니라 시간 메타 옆에 붙인다.
 */
export function HomeDigestFeedRow({
  title,
  titleLines,
  variant = 'digest',
  density = 'default',
  timeLabel,
  trailText,
  summary,
  summaryLines = 1,
  sourceEntries = [],
  badges,
  bordered = false,
  footerLead,
  isFresh = false,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, variant, density),
    [theme, scaleFont, feedTypo, variant, density],
  );
  const resolvedTitleLines =
    titleLines === null ? undefined : titleLines != null ? titleLines : variant === 'signal' ? undefined : 2;
  const resolvedSummaryLines = summaryLines === null ? undefined : summaryLines;
  const hasTime = Boolean(timeLabel?.trim() && timeLabel !== '—');
  const hasFooter =
    Boolean(footerLead) ||
    sourceEntries.length > 0 ||
    Boolean(trailText?.trim()) ||
    hasTime ||
    isFresh;
  const trimmedSummary = summary?.trim() || '';

  const footer = hasFooter ? (
    <View style={styles.footer}>
      <View style={styles.footerLead}>
        {footerLead}
        {sourceEntries.length > 0 ? (
          <SourceIconStack sources={sourceEntries} size={18} maxVisible={2} />
        ) : null}
        {trailText?.trim() ? (
          <Text style={styles.trailText} numberOfLines={1}>
            {trailText.trim()}
          </Text>
        ) : null}
      </View>
      {hasTime || isFresh ? (
        <Text
          style={[styles.timeText, isFresh && styles.timeTextFresh]}
          numberOfLines={1}
          accessibilityLabel={isFresh ? t('digestFreshBadgeA11y') : undefined}>
          {isFresh && hasTime
            ? `${t('digestFreshBadge')} · ${timeLabel}`
            : isFresh
              ? t('digestFreshBadge')
              : timeLabel}
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
      <ChangeTintedText style={styles.title} numberOfLines={resolvedTitleLines}>
        {title}
      </ChangeTintedText>
      {trimmedSummary && (resolvedSummaryLines == null || resolvedSummaryLines > 0) ? (
        <ChangeTintedText
          style={styles.summary}
          numberOfLines={resolvedSummaryLines}>
          {trimmedSummary}
        </ChangeTintedText>
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
  density: 'default' | 'home',
) {
  const isSignal = variant === 'signal';
  const homeScan = density === 'home' && !isSignal;
  const metaSize = ft.ff(homeScan ? HOME_NEWS_META_PX : FEED_META_TIME_PX);
  const titleSize = homeScan ? HOME_NEWS_TITLE_PX : FEED_DIGEST_TITLE_PX;
  const titleLine = homeScan ? HOME_NEWS_TITLE_LINE_PX : FEED_DIGEST_TITLE_LINE_PX;
  return StyleSheet.create({
    row: {
      gap: homeScan ? 5 : 4,
      paddingVertical: homeScan ? HOME_NEWS_ROW_PAD_V : 7,
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
      fontSize: isSignal ? ft.signalBodyFont(FEED_SIGNAL_PREVIEW_PX) : ft.ff(titleSize),
      lineHeight: isSignal ? sf(22) : ft.ff(titleLine),
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
      maxWidth: '46%',
      fontSize: metaSize,
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      textAlign: 'right',
    },
    timeTextFresh: {
      color: theme.green,
      fontWeight: ft.emphasisWeight,
    },
    summary: {
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(16),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
