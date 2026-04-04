import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';

import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { getNativeAdUnitId } from '@/services/admob';

/** PRD: 피드 5개마다 1개 · "광고" 표기 */
export function AdPlaceholder() {
  const { theme } = useSignalTheme();
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let cancelled = false;
    NativeAd.createForAdRequest(getNativeAdUnitId())
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
  }, []);

  useEffect(() => {
    if (!nativeAd) return;
    return () => {
      nativeAd.destroy();
    };
  }, [nativeAd]);

  if (!nativeAd) {
    return null;
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.badge, { color: theme.textDim }]} accessibilityLabel="광고">
        광고
      </Text>

      <View style={styles.row}>
        {nativeAd.icon ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : null}
        <View style={styles.textCol}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={[styles.headline, { color: theme.text }]} numberOfLines={2}>
              {nativeAd.headline}
            </Text>
          </NativeAsset>
          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={2}>
                {nativeAd.body}
              </Text>
            </NativeAsset>
          ) : null}
        </View>
      </View>

      <NativeMediaView resizeMode="cover" style={styles.media} />

      {nativeAd.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={[styles.cta, { backgroundColor: theme.green }]}>{nativeAd.callToAction}</Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
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
