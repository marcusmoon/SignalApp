import { StyleSheet, Text, View } from 'react-native';

import { SIGNAL } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';

/** 웹: AdMob 네이티브 SDK 없음 — 자리 표시만 */
export function AdPlaceholder() {
  const { t } = useLocale();
  return (
    <View style={styles.wrap} accessibilityLabel={t('commonAd')}>
      <Text style={styles.badge}>{t('commonAd')}</Text>
      <Text style={styles.title}>{t('adPlaceholderWebMessage')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#15151C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
    padding: 14,
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    color: SIGNAL.textDim,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  title: {
    color: SIGNAL.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
