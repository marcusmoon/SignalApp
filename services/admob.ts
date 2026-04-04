import { Platform } from 'react-native';

function getGoogleAdsModule(): typeof import('react-native-google-mobile-ads') {
  return require('react-native-google-mobile-ads');
}

export function getNativeAdUnitId(): string {
  if (Platform.OS === 'web') return '';
  const { TestIds } = getGoogleAdsModule();
  const u = process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID?.trim();
  return u && u.length > 0 ? u : TestIds.NATIVE;
}

export function getBannerAdUnitId(): string {
  if (Platform.OS === 'web') return '';
  const { TestIds } = getGoogleAdsModule();
  const u = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim();
  return u && u.length > 0 ? u : TestIds.BANNER;
}

export async function initializeAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  const { MobileAds } = getGoogleAdsModule();
  await MobileAds().initialize();
}
