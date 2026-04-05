import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { getGoogleMobileAdsModule, getNativeAdUnitId } from '@/services/admob';

type AdsModule = typeof import('react-native-google-mobile-ads');

/** PRD: 피드 5개마다 1개 · "광고" 표기 — SDK 없으면 자리만 */
export function AdPlaceholder() {
  const { theme } = useSignalTheme();
  const ads = useMemo(() => getGoogleMobileAdsModule(), []) as AdsModule | null;
  const [nativeAd, setNativeAd] = useState<unknown>(null);

  useEffect(() => {
    if (!ads) return;
    let cancelled = false;
    ads.NativeAd.createForAdRequest(getNativeAdUnitId())
      .then((ad) => {
        if (!cancelled) setNativeAd(ad);
        else ad.destroy();
      })
      .catch(() => {
        if (!cancelled) setNativeAd(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ads]);

  useEffect(() => {
    if (!nativeAd || typeof nativeAd !== 'object') return;
    const ad = nativeAd as { destroy: () => void };
    return () => {
      ad.destroy();
    };
  }, [nativeAd]);

  if (!ads) {
    return <FallbackAdPlaceholder theme={theme} reason="sdk" />;
  }

  if (!nativeAd) {
    return null;
  }

  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = ads;
  const ad = nativeAd as {
    icon?: { url: string } | null;
    headline?: string;
    body?: string | null;
    callToAction?: string | null;
  };

  return (
    <NativeAdView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nativeAd={nativeAd as any}
      style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.badge, { color: theme.textDim }]} accessibilityLabel="광고">
        광고
      </Text>

      <View style={styles.row}>
        {ad.icon ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : null}
        <View style={styles.textCol}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={[styles.headline, { color: theme.text }]} numberOfLines={2}>
              {ad.headline}
            </Text>
          </NativeAsset>
          {ad.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={2}>
                {ad.body}
              </Text>
            </NativeAsset>
          ) : null}
        </View>
      </View>

      <NativeMediaView resizeMode="cover" style={styles.media} />

      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={[styles.cta, { backgroundColor: theme.green }]}>{ad.callToAction}</Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
}

function FallbackAdPlaceholder({ theme, reason }: { theme: AppTheme; reason: 'sdk' }) {
  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.badge, { color: theme.textDim }]} accessibilityLabel="광고">
        광고
      </Text>
      <Text style={[styles.fallback, { color: theme.textMuted }]}>
        {reason === 'sdk' ? '광고 SDK를 불러오지 못했습니다.' : '광고를 불러오지 못했습니다.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  fallback: {
    fontSize: 12,
    lineHeight: 17,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 8 },
  textCol: { flex: 1, minWidth: 0 },
  headline: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  body: { fontSize: 12, lineHeight: 17 },
  media: {
    width: '100%',
    minHeight: 120,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: '#0A0A0F',
  },
  cta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#0A0A0F',
    overflow: 'hidden',
  },
});
