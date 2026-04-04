import { StyleSheet, Text, View } from 'react-native';

import { SIGNAL } from '@/constants/theme';

/** 웹: AdMob 네이티브 SDK 없음 — 자리 표시만 */
export function AdPlaceholder() {
  return (
    <View style={styles.wrap} accessibilityLabel="광고">
      <Text style={styles.badge}>광고</Text>
      <Text style={styles.title}>모바일 앱에서 광고가 표시됩니다</Text>
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
