import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { getBannerAdUnitId } from '@/services/admob';

/** 캘린더 하단 앵커 적응형 배너 */
export function SignalBannerAd() {
  const { theme } = useSignalTheme();
  const { width } = useWindowDimensions();
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return null;
  }

  const adWidth = Math.max(0, width - 32);

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]} accessibilityLabel="광고">
      <Text style={[styles.badge, { color: theme.textDim }]}>광고</Text>
      <BannerAd
        unitId={getBannerAdUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        width={adWidth}
        onAdFailedToLoad={() => setHidden(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
});
