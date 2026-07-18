import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { MarketBriefingBlock } from '@/components/signal/MarketBriefingBlock';
import { COMFORT_GAP_LG, COMFORT_GAP_SM } from '@/constants/comfortDensity';
import type { AppTheme } from '@/constants/theme';
import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
  BOTTOM_SHEET_SCROLL_STYLE,
} from '@/constants/bottomSheetLayout';
import { UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';

type Props = {
  visible: boolean;
  briefing: SignalApiMarketBriefing | null;
  title: string;
  onClose: () => void;
};

/** 홈 시장 브리핑 → 해당 회차 본문 (뉴스·공시 DigestSourcesSheet와 동일 셸). */
export function MarketBriefingSheet({
  visible,
  briefing,
  title,
  onClose,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

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
            <Text style={styles.sheetKicker}>{t('ipadHomeSignalTitle')}</Text>
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
              <HomeSectionHeader title={title} showChevron={false} />
            </View>
            {briefing ? (
              <MarketBriefingBlock
                briefing={briefing}
                theme={theme}
                scaleFont={scaleFont}
                changeColorConvention={quoteChange.convention ?? 'korea'}
              />
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
