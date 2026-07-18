import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import { COMFORT_GAP_LG, COMFORT_GAP_SM } from '@/constants/comfortDensity';
import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
  BOTTOM_SHEET_SCROLL_STYLE,
} from '@/constants/bottomSheetLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  etfInsightHeatmapLabel,
  etfInsightLabeledRows,
  etfInsightRotationLines,
  etfInsightThemeLabel,
} from '@/domain/etfInsights/display';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { formatFeedItemTimeLabel } from '@/utils/date';

type Props = {
  visible: boolean;
  insight: SignalApiEtfInsight | null;
  onClose: () => void;
};

/** 홈 ETF 인사이트 카드 → 본문·테마·수급·히트맵·출처 */
export function EtfInsightSheet({ visible, insight, onClose }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const themes = useMemo(
    () => etfInsightLabeledRows(insight?.themes || [], etfInsightThemeLabel),
    [insight],
  );
  const flows = useMemo(() => etfInsightLabeledRows(insight?.flowHighlights || []), [insight]);
  const heatmap = useMemo(
    () => etfInsightLabeledRows(insight?.heatmap || [], etfInsightHeatmapLabel),
    [insight],
  );
  const rotationLines = useMemo(() => etfInsightRotationLines(insight?.rotation), [insight]);
  const insights = insight?.insights?.filter((line) => String(line || '').trim()) || [];
  const sources = insight?.sourceRefs || [];
  const periodLabel = [
    insight?.insightDate?.trim() || '',
    insight?.period?.trim() ? t('etfInsightPeriodLabel', { period: insight.period }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('filterSheetDismissA11y')}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Text style={styles.sheetKicker}>{t('etfInsightDetailKicker')}</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('filterSheetDone')}>
              <FontAwesome name="times" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {insight ? (
              <>
                <View style={styles.section}>
                  <HomeSectionHeader title={insight.title} showChevron={false} />
                  {periodLabel ? <Text style={styles.meta}>{periodLabel}</Text> : null}
                  {insight.summary?.trim() ? (
                    <Text style={styles.summary}>{insight.summary.trim()}</Text>
                  ) : null}
                </View>

                {insights.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeading}>{t('etfInsightKeyPoints')}</Text>
                    <View style={styles.card}>
                      {insights.map((line, index) => (
                        <HomeDigestFeedRow
                          key={`${insight.id}-insight-${index}`}
                          title={line}
                          titleLines={null}
                          bordered={index < insights.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {themes.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeading}>{t('etfInsightThemes')}</Text>
                    <View style={styles.card}>
                      {themes.map((row, index) => (
                        <HomeDigestFeedRow
                          key={`${insight.id}-theme-${index}`}
                          title={row.label}
                          titleLines={null}
                          trailText={row.trail}
                          summary={row.summary}
                          bordered={index < themes.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {flows.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeading}>{t('etfInsightFlows')}</Text>
                    <View style={styles.card}>
                      {flows.map((row, index) => (
                        <HomeDigestFeedRow
                          key={`${insight.id}-flow-${index}`}
                          title={row.label}
                          titleLines={null}
                          trailText={row.trail}
                          bordered={index < flows.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {heatmap.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeading}>{t('etfInsightHeatmap')}</Text>
                    <View style={styles.card}>
                      {heatmap.map((row, index) => (
                        <HomeDigestFeedRow
                          key={`${insight.id}-heat-${index}`}
                          title={row.label}
                          titleLines={null}
                          trailText={row.trail}
                          bordered={index < heatmap.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {rotationLines.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeading}>{t('etfInsightRotation')}</Text>
                    <View style={styles.card}>
                      {rotationLines.map((line, index) => (
                        <HomeDigestFeedRow
                          key={`${insight.id}-rot-${index}`}
                          title={line}
                          titleLines={null}
                          bordered={index < rotationLines.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {sources.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeading}>{t('etfInsightSources')}</Text>
                    <View style={styles.card}>
                      {sources.map((ref, index) => {
                        const title = String(ref.title || ref.sourceName || ref.url || '').trim();
                        if (!title) return null;
                        return (
                          <HomeDigestFeedRow
                            key={`${insight.id}-src-${index}`}
                            title={title}
                            titleLines={null}
                            trailText={ref.sourceName?.trim() || null}
                            timeLabel={formatFeedItemTimeLabel(ref.publishedAt, locale)}
                            sourceEntries={briefingSourceIconEntries([ref])}
                            bordered={index < sources.length - 1}
                            onPress={
                              ref.url
                                ? () => {
                                    void openConfiguredExternalLink({
                                      webUrl: ref.url!,
                                      openInAppBrowser: true,
                                    });
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: BOTTOM_SHEET_BACKDROP_COLOR,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: UI_RADIUS_SHEET,
      borderTopRightRadius: UI_RADIUS_SHEET,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    },
    grab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 16,
      marginBottom: 8,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      marginBottom: 8,
    },
    sheetKicker: {
      flex: 1,
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textMuted,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    closeBtnPressed: {
      opacity: 0.7,
    },
    scroll: {
      ...BOTTOM_SHEET_SCROLL_STYLE,
    },
    scrollContent: {
      paddingBottom: 8,
      gap: COMFORT_GAP_LG,
    },
    section: {
      gap: COMFORT_GAP_SM,
    },
    meta: {
      fontSize: sf(12),
      lineHeight: sf(16),
      color: theme.textDim,
      fontWeight: '600',
    },
    summary: {
      fontSize: sf(14),
      lineHeight: sf(21),
      color: theme.textMuted,
    },
    sectionHeading: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.text,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      overflow: 'hidden',
    },
  });
}
