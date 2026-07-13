import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { getBannerAdUnitId, getGoogleMobileAdsModule } from '@/integrations/admob/native';
import { useAdsEnabled } from '@/services/adsRuntimeConfig';

type AdsModule = typeof import('react-native-google-mobile-ads');

import type { SignalBannerAdVariant } from '@/components/signal/signalBannerAd.types';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** `large`: 더보기 등 스크롤 하단 — 인라인 적응형(더 높은 슬롯) */
  variant?: SignalBannerAdVariant;
};

const LARGE_INLINE_MAX_HEIGHT = 280;

/** 캘린더·더보기 등 배너 슬롯 — SDK 없으면 웹과 유사한 자리 표시 */
export function SignalBannerAd({ style, variant = 'standard' }: Props = {}) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const adsEnabled = useAdsEnabled();
  const ads = useMemo(() => getGoogleMobileAdsModule(), []) as AdsModule | null;
  const [hidden, setHidden] = useState(false);
  const canRenderBanner = Boolean(ads?.BannerAd && ads?.BannerAdSize);

  if (!adsEnabled || hidden) {
    return null;
  }

  const adWidth = Math.max(0, width - 32);

  const isLarge = variant === 'large';

  if (!ads || !canRenderBanner) {
    return <BannerFallback theme={theme} style={style} large={isLarge} />;
  }

  const { BannerAd, BannerAdSize } = ads;

  return (
    <View
      style={[
        styles.wrap,
        isLarge && styles.wrapLarge,
        { borderColor: theme.border, backgroundColor: theme.card },
        style,
      ]}
      accessibilityLabel={t('commonAd')}>
      <Text style={[styles.badge, { color: theme.textDim }]}>{t('commonAd')}</Text>
      <BannerAd
        unitId={getBannerAdUnitId()}
        size={
          isLarge ? BannerAdSize.INLINE_ADAPTIVE_BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER
        }
        width={adWidth}
        maxHeight={isLarge ? LARGE_INLINE_MAX_HEIGHT : undefined}
        onAdFailedToLoad={() => setHidden(true)}
      />
    </View>
  );
}

function BannerFallback({
  theme,
  style,
  large,
}: {
  theme: AppTheme;
  style?: StyleProp<ViewStyle>;
  large?: boolean;
}) {
  const { t } = useLocale();
  return (
    <View
      style={[
        styles.wrap,
        large && styles.wrapLarge,
        large && styles.fallbackLarge,
        { borderColor: theme.border, backgroundColor: theme.card },
        style,
      ]}>
      <Text style={[styles.badge, { color: theme.textDim }]}>{t('commonAd')}</Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{t('adBannerNativeFallback')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  wrapLarge: {
    paddingVertical: 14,
    borderRadius: 8,
  },
  fallbackLarge: {
    minHeight: 250,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    alignSelf: 'stretch',
  },
});
