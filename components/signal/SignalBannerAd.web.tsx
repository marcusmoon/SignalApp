import { StyleSheet, Text, View } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

export function SignalBannerAd() {
  const { theme } = useSignalTheme();
  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: '#12121A' }]}>
      <Text style={[styles.badge, { color: theme.textDim }]}>광고</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>모바일 앱에서 배너 광고가 표시됩니다</Text>
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
