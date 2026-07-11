import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useAdsEnabled } from '@/services/adsRuntimeConfig';

import type { SignalBannerAdVariant } from '@/components/signal/signalBannerAd.types';

type Props = {
  style?: StyleProp<ViewStyle>;
  variant?: SignalBannerAdVariant;
};

export function SignalBannerAd({ style, variant = 'standard' }: Props = {}) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const adsEnabled = useAdsEnabled();
  const isLarge = variant === 'large';

  if (!adsEnabled) return null;

  return (
    <View
      style={[
        styles.wrap,
        isLarge && styles.wrapLarge,
        isLarge && styles.placeholderLarge,
        { borderColor: theme.border, backgroundColor: theme.card },
        style,
      ]}>
      <Text style={[styles.badge, { color: theme.textDim }]}>{t('commonAd')}</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{t('adBannerWebHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  wrapLarge: {
    paddingVertical: 14,
    borderRadius: 8,
  },
  placeholderLarge: {
    minHeight: 250,
    justifyContent: 'center',
  },
  badge: { fontSize: 10, marginBottom: 4 },
  hint: { fontSize: 12 },
});
