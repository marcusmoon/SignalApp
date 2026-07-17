import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { COMFORT_GAP_LG, COMFORT_GAP_SM } from '@/constants/comfortDensity';
import type { AppTheme } from '@/constants/theme';
import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
  BOTTOM_SHEET_SCROLL_STYLE,
} from '@/constants/bottomSheetLayout';
import { UI_RADIUS_CARD_LG, UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { AppLocale, MessageId } from '@/locales/messages';
import type { ThemeAppearanceMode } from '@/services/themeAppearancePreference';

const LOCALE_ORDER: AppLocale[] = ['ko', 'en', 'ja'];
const LOCALE_LABEL: Record<AppLocale, MessageId> = {
  ko: 'localeNameKo',
  en: 'localeNameEn',
  ja: 'localeNameJa',
};

const APPEARANCE_MODE_ORDER: ThemeAppearanceMode[] = ['system', 'light', 'dark'];
const APPEARANCE_MODE_LABEL: Record<ThemeAppearanceMode, MessageId> = {
  system: 'settingsAppearanceSystem',
  light: 'settingsAppearanceLight',
  dark: 'settingsAppearanceDark',
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** 헤더 퀵 설정 — 언어·화면 모드 (표시 설정과 동일 저장소). */
export function QuickSettingsSheet({ visible, onClose }: Props) {
  const { theme, scaleFont, appearanceMode, setAppearanceMode } = useSignalTheme();
  const { t, locale, setLocale } = useLocale();
  const insets = useSafeAreaInsets();
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
            <Text style={styles.sheetKicker}>{t('quickSettingsTitle')}</Text>
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
              <HomeSectionHeader title={t('settingsThemeLanguageSection')} showChevron={false} />
              <View style={styles.feedCard}>
                <View style={styles.segmentTrack}>
                  {LOCALE_ORDER.map((loc) => (
                    <Pressable
                      key={loc}
                      onPress={() => void setLocale(loc)}
                      style={[styles.segment, locale === loc && styles.segmentActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: locale === loc }}
                      accessibilityLabel={t(LOCALE_LABEL[loc])}>
                      <Text style={[styles.segmentText, locale === loc && styles.segmentTextActive]}>
                        {t(LOCALE_LABEL[loc])}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <HomeSectionHeader title={t('settingsAppearanceSection')} showChevron={false} />
              <View style={styles.feedCard}>
                <View style={styles.segmentTrack}>
                  {APPEARANCE_MODE_ORDER.map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => void setAppearanceMode(mode)}
                      style={[styles.segment, appearanceMode === mode && styles.segmentActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: appearanceMode === mode }}
                      accessibilityLabel={t(APPEARANCE_MODE_LABEL[mode])}>
                      <Text
                        style={[styles.segmentText, appearanceMode === mode && styles.segmentTextActive]}>
                        {t(APPEARANCE_MODE_LABEL[mode])}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
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
    feedCard: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 10,
      paddingVertical: 10,
      overflow: 'hidden',
    },
    segmentTrack: {
      flexDirection: 'row',
      backgroundColor: theme.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      gap: 6,
    },
    segment: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: theme.green,
    },
    segmentText: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.textDim,
      textAlign: 'center',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
  });
}
