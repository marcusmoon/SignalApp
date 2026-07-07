import { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { isWeb, WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useOtaBanner } from '@/contexts/OtaBannerContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  UpdatePromptCard,
  UpdatePromptStrip,
  useUpdatePromptMessageStyle,
} from '@/components/signal/UpdatePromptStrip';

/**
 * 헤더 바로 아래에 두어 아래 콘텐츠를 밀어 올린다.
 * 포커스된 화면에서만 마운트하는 것을 권장(useIsFocused).
 */
export function OtaUpdateBanner() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const { visible, previewMode, loading, dismiss, apply } = useOtaBanner();
  const messageStyle = useUpdatePromptMessageStyle('left');
  const styles = useMemo(() => makeActionStyles(theme), [theme]);
  const iconColor = isWeb ? WEB_SIGNAL_CSS.green : theme.green;

  if (Platform.OS === 'web') return null;
  if (!visible) return null;

  return (
    <UpdatePromptStrip>
      <UpdatePromptCard>
        <View style={styles.row}>
          <FontAwesome name="cloud-download" size={14} color={iconColor} style={styles.icon} />
          <Text style={messageStyle} numberOfLines={2}>
            {previewMode ? t('otaUpdatePreviewMessage') : t('otaUpdateAvailable')}
          </Text>
          <Pressable
            onPress={() => void apply()}
            disabled={loading}
            style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed, loading && styles.applyBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t('otaUpdateApply')}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
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
            <FontAwesome name="times" size={16} color={theme.textMuted} />
          </Pressable>
        </View>
      </UpdatePromptCard>
    </UpdatePromptStrip>
  );
}

function makeActionStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: '100%',
    },
    icon: {
      marginTop: 1,
    },
    applyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.green,
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
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
      color: '#FFFFFF',
    },
    dismissBtn: {
      padding: 2,
      flexShrink: 0,
    },
  });
}
