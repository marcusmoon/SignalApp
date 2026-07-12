import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import {
  COMFORT_GAP_LG,
  COMFORT_GAP_SM,
  COMFORT_PADDING_ROW_V,
} from '@/constants/comfortDensity';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG, UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export type DigestSourceSheetRow = {
  key: string;
  title: string;
  subtitle?: string;
  url?: string | null;
  timeLabel?: string | null;
};

type Props = {
  visible: boolean;
  digestTitle: string;
  digestSummary?: string;
  rows: DigestSourceSheetRow[];
  onClose: () => void;
};

export function DigestSourcesSheet({
  visible,
  digestTitle,
  digestSummary,
  rows,
  onClose,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const summary = digestSummary?.trim() || '';
  const hasSources = rows.length > 0;

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
            <Text style={styles.sheetKicker}>{t('feedDigestDetailTitle')}</Text>
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
            <View style={styles.section}>
              <HomeSectionHeader title={digestTitle} showChevron={false} />
              {summary ? (
                <View style={styles.feedCard}>
                  <Text style={styles.digestSummary}>{summary}</Text>
                </View>
              ) : null}
            </View>

            {hasSources ? (
              <View style={styles.section}>
                <HomeSectionHeader title={t('feedDigestSourcesTitle')} showChevron={false} />
                <View style={[styles.feedCard, styles.feedCardCompact]}>
                  <View style={styles.sourceList}>
                    {rows.map((row, index) => {
                      const refUrl = row.url || undefined;
                      return (
                        <HomeDigestFeedRow
                          key={row.key}
                          title={row.title}
                          titleLines={3}
                          trailText={row.subtitle?.trim() || null}
                          timeLabel={row.timeLabel?.trim() || null}
                          bordered={index < rows.length - 1}
                          onPress={
                            refUrl
                              ? () => {
                                  void Linking.openURL(refUrl).catch(() => null);
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
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
      maxHeight: '78%',
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
      marginBottom: COMFORT_GAP_SM,
    },
    sheetKicker: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 0.15,
      flex: 1,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    closeBtnPressed: {
      opacity: 0.85,
    },
    scroll: {
      flexGrow: 0,
      maxHeight: 480,
    },
    scrollContent: {
      paddingBottom: 8,
      gap: COMFORT_GAP_LG,
    },
    section: {
      gap: COMFORT_GAP_SM,
    },
    feedCard: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: COMFORT_PADDING_ROW_V,
      overflow: 'hidden',
    },
    feedCardCompact: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    digestSummary: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    sourceList: {
      gap: 0,
    },
  });
}
