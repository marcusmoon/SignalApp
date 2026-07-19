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
  /** 셸 헤드라인과 같으면 summary 중복 숨김 */
  showSummary?: boolean;
  titleText?: string;
};

/** 오늘 정리 본문 — 장중·ETF와 동일: leadPanel + sectionFeedCard */
export function TodayBriefingBlock({ briefing, showSummary = true, titleText }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const lead = briefing.headline?.trim() || briefing.summary?.trim() || '';
  const summary = briefing.summary?.trim() || '';
  const title = titleText?.trim() || lead;
  const summaryBody = showSummary && summary && summary !== title ? summary : '';

  return (
    <View style={styles.root}>
      {summaryBody ? (
        <View style={styles.leadPanel}>
          <ChangeTintedText style={styles.summary}>{summaryBody}</ChangeTintedText>
        </View>
      ) : null}

      {briefing.keyPoints.length > 0 ? (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('todayBriefingKeyPoints')}</Text>
          </View>
          <View style={styles.sectionFeedCard}>
            {briefing.keyPoints.map((point, index) => (
              <HomeDigestFeedRow
                key={`${briefing.id}-point-${index}`}
                title={point}
                titleLines={null}
                bordered={index < briefing.keyPoints.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}

      {briefing.sourceRefs.length > 0 ? (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('todayBriefingSources')}</Text>
          </View>
          <View style={styles.sectionFeedCard}>
            {briefing.sourceRefs.map((ref, index) => (
              <HomeDigestFeedRow
                key={`${briefing.id}-source-${index}`}
                title={ref.title || ref.sourceName || ref.url || ''}
                titleLines={null}
                trailText={ref.sourceName?.trim() || null}
                timeLabel={formatFeedItemTimeLabel(ref.publishedAt, locale)}
                sourceEntries={briefingSourceIconEntries([ref])}
                bordered={index < briefing.sourceRefs.length - 1}
                onPress={
                  ref.url
                    ? () => {
                        void Linking.openURL(ref.url!);
                      }
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const leadTint =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}0A` : theme.bgElevated;
  return StyleSheet.create({
    root: {
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
    summary: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.text,
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
