import { StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export function SignalBannerAd() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: '#12121A' }]}>
      <Text style={[styles.badge, { color: theme.textDim }]}>{t('commonAd')}</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{t('adBannerWebHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  badge: { fontSize: 10, marginBottom: 4 },
  hint: { fontSize: 12 },
});
