import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatFeedItemTimeLabel } from '@/utils/date';

type Props = {
  briefing: SignalApiTodayBriefing;
  theme: AppTheme;
  scaleFont: (n: number) => number;
};

function BriefingSection({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * 마감 브리핑 본문 — 시장 브리핑(`MarketBriefingBlock`)과 동일 리드·섹션 밀도.
 * 제목(headline)은 시트/상세 헤더에서 노출. lead(요약·핵심 포인트) → 출처. 빈 필드는 숨김.
 */
export function TodayBriefingBlock({ briefing, theme, scaleFont }: Props) {
  const { t, locale } = useLocale();
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const headline = briefing.headline?.trim() || briefing.title?.trim() || '';
  const summary = briefing.summary?.trim() || '';
  /** 시트/상세 헤더 제목과 같으면 리드에서 중복 숨김 */
  const showSummary = Boolean(summary) && summary !== headline;
  const keyPoints = (briefing.keyPoints || []).map((line) => String(line || '').trim()).filter(Boolean);
  const sources = useMemo(() => {
    const raw = Array.isArray(briefing.sourceRefs) ? briefing.sourceRefs : [];
    return raw.filter((ref) => {
      const title = String(ref?.title || ref?.sourceName || ref?.url || '').trim();
      return Boolean(title);
    });
  }, [briefing.sourceRefs]);

  const hasLead = showSummary || keyPoints.length > 0;

  return (
    <View style={styles.block}>
      {hasLead ? (
        <View style={styles.leadPanel}>
          {showSummary ? <ChangeTintedText style={styles.summary}>{summary}</ChangeTintedText> : null}

          {keyPoints.length > 0 ? (
            <View style={styles.overviewBlock}>
              {showSummary ? <View style={styles.leadDivider} /> : null}
              <Text style={styles.overviewKicker}>{t('todayBriefingKeyPoints')}</Text>
              <View style={styles.overviewList}>
                {keyPoints.map((line, index) => (
                  <View key={`${briefing.id}-point-${index}`} style={styles.overviewRow}>
                    <View style={styles.overviewDot} />
                    <ChangeTintedText style={styles.overviewText}>{line}</ChangeTintedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {sources.length > 0 ? (
        <BriefingSection title={t('todayBriefingSources')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {sources.map((ref, index) => {
              const title = String(ref.title || ref.sourceName || ref.url || '').trim();
              return (
                <HomeDigestFeedRow
                  key={`${briefing.id}-src-${index}`}
                  title={title}
                  titleLines={null}
                  trailText={ref.sourceName?.trim() || null}
                  timeLabel={
                    ref.publishedAt ? formatFeedItemTimeLabel(ref.publishedAt, locale) : null
                  }
                  sourceEntries={briefingSourceIconEntries([ref])}
                  bordered={index < sources.length - 1}
                  onPress={
                    ref.url
                      ? () => {
                          void Linking.openURL(ref.url!);
                        }
                      : undefined
                  }
                />
              );
            })}
          </View>
        </BriefingSection>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const leadTint =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}0A` : theme.bgElevated;

  return StyleSheet.create({
    block: {
      gap: 20,
    },
    leadPanel: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: leadTint,
      padding: ft.pad(16),
      gap: 14,
    },
    leadDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginBottom: 2,
    },
    summary: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.text,
    },
    overviewBlock: {
      gap: 10,
    },
    overviewKicker: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      letterSpacing: 0.1,
    },
    overviewList: {
      gap: 10,
    },
    overviewRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    overviewDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.green,
      marginTop: sf(8),
      flexShrink: 0,
    },
    overviewText: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.textDim,
    },
    sectionWrap: {
      gap: 16,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    sectionTitle: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      fontSize: ft.signalTitleFont(16),
      fontWeight: ft.titleWeight,
      letterSpacing: -0.15,
      color: theme.text,
    },
    sectionFeedCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 10,
      paddingVertical: 8,
      overflow: 'hidden',
    },
  });
}
