import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { TodayBriefingBlock } from '@/components/signal/TodayBriefingBlock';
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
import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';

type Props = {
  visible: boolean;
  briefing: SignalApiTodayBriefing | null;
  onClose: () => void;
};

/** 홈 히어로(오늘 정리) → 바텀시트 (MarketBriefingSheet와 동일 셸) */
export function TodayBriefingSheet({ visible, briefing, onClose }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const title = useMemo(() => {
    if (!briefing) return '';
    return (
      briefing.headline?.trim() ||
      briefing.summary?.trim() ||
      briefing.title?.trim() ||
      ''
    );
  }, [briefing]);

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
            <Text style={styles.sheetKicker}>{t('todayBriefingDetailKicker')}</Text>
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
              {title ? <HomeSectionHeader title={title} showChevron={false} /> : null}
            </View>
            {briefing ? (
              <TodayBriefingBlock briefing={briefing} titleText={title} showSummary />
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
      marginBottom: COMFORT_GAP_SM,
    },
    sheetKicker: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '600',
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
      ...BOTTOM_SHEET_SCROLL_STYLE,
    },
    scrollContent: {
      paddingBottom: 8,
      gap: COMFORT_GAP_LG,
    },
    section: {
      gap: COMFORT_GAP_SM,
    },
  });
}
