import { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useOtaBanner } from '@/contexts/OtaBannerContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * 헤더 바로 아래에 두어 아래 콘텐츠를 밀어 올린다.
 * 포커스된 화면에서만 마운트하는 것을 권장(useIsFocused).
 */
export function OtaUpdateBanner() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const { visible, previewMode, loading, dismiss, apply } = useOtaBanner();
  const styles = useMemo(() => makeBannerStyles(theme), [theme]);

  if (Platform.OS === 'web') return null;
  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <FontAwesome name="cloud-download" size={16} color={theme.green} style={styles.icon} />
        <Text style={styles.message} numberOfLines={2}>
          {previewMode ? t('otaUpdatePreviewMessage') : t('otaUpdateAvailable')}
        </Text>
        <Pressable
          onPress={() => void apply()}
          disabled={loading}
          style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed, loading && styles.applyBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('otaUpdateApply')}>
          {loading ? (
            <ActivityIndicator color="#0A0A0F" size="small" />
          ) : (
            <Text style={styles.applyText}>{t('otaUpdateApply')}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          style={styles.dismissBtn}
          accessibilityRole="button"
          accessibilityLabel={t('otaUpdateDismiss')}>
          <FontAwesome name="times" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function makeBannerStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      backgroundColor: theme.greenDim,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.greenBorder,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
    },
    icon: {
      marginTop: 1,
    },
    message: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      lineHeight: 18,
    },
    applyBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.green,
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnPressed: {
      opacity: 0.88,
    },
    applyBtnDisabled: {
      opacity: 0.7,
    },
    applyText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#0A0A0F',
    },
    dismissBtn: {
      padding: 4,
    },
  });
}
