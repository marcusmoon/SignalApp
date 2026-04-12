import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { getBannerAdUnitId, getGoogleMobileAdsModule } from '@/services/admob';

type AdsModule = typeof import('react-native-google-mobile-ads');

/** 캘린더 하단 앵커 적응형 배너 — SDK 없으면 웹과 유사한 자리 표시 */
export function SignalBannerAd() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const ads = useMemo(() => getGoogleMobileAdsModule(), []) as AdsModule | null;
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return null;
  }

  const adWidth = Math.max(0, width - 32);

  if (!ads) {
    return <BannerFallback theme={theme} />;
  }

  const { BannerAd, BannerAdSize } = ads;

  return (
    <View
      style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]}
      accessibilityLabel={t('commonAd')}>
      <Text style={[styles.badge, { color: theme.textDim }]}>{t('commonAd')}</Text>
      <BannerAd
        unitId={getBannerAdUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        width={adWidth}
        onAdFailedToLoad={() => setHidden(true)}
      />
    </View>
  );
}

function BannerFallback({ theme }: { theme: AppTheme }) {
  const { t } = useLocale();
  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.badge, { color: theme.textDim }]}>{t('commonAd')}</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{t('adBannerNativeFallback')}</Text>
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
  hint: {
    fontSize: 12,
    alignSelf: 'stretch',
  },
});
