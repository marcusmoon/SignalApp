import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

type AdsModule = typeof import('react-native-google-mobile-ads');

let adsModuleCache: AdsModule | null | undefined;

/**
 * RNGoogleMobileAdsModule 없으면 require 시 invariant로 크래시(try/catch 불가) → 먼저 조회.
 */
function isGoogleAdsNativeModuleLinked(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    if (NativeModules.RNGoogleMobileAdsModule != null) return true;
    return TurboModuleRegistry.get('RNGoogleMobileAdsModule') != null;
  } catch {
    return false;
  }
}

/**
 * 네이티브에 모듈이 있을 때만 패키지 require. Expo Go·미포함 빌드에서는 null.
 * 광고 UI 컴포넌트도 이 함수만 사용할 것(직접 require 금지).
 */
export function getGoogleMobileAdsModule(): AdsModule | null {
  if (adsModuleCache !== undefined) {
    return adsModuleCache;
  }
  if (!isGoogleAdsNativeModuleLinked()) {
    adsModuleCache = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    adsModuleCache = require('react-native-google-mobile-ads') as AdsModule;
    return adsModuleCache;
  } catch {
    adsModuleCache = null;
    return null;
  }
}

const FALLBACK_NATIVE_UNIT = 'ca-app-pub-3940256099942544/2247696110';
const FALLBACK_BANNER_UNIT = 'ca-app-pub-3940256099942544/6300978111';

export function getNativeAdUnitId(): string {
  if (Platform.OS === 'web') return '';
  const u = process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID?.trim();
  if (u && u.length > 0) return u;
  const m = getGoogleMobileAdsModule();
  if (m) return m.TestIds.NATIVE;
  return FALLBACK_NATIVE_UNIT;
}

export function getBannerAdUnitId(): string {
  if (Platform.OS === 'web') return '';
  const u = process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim();
  if (u && u.length > 0) return u;
  const m = getGoogleMobileAdsModule();
  if (m) return m.TestIds.BANNER;
  return FALLBACK_BANNER_UNIT;
}

export async function initializeAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  const m = getGoogleMobileAdsModule();
  if (!m) return;
  try {
    await m.MobileAds().initialize();
  } catch {
    /* ignore */
  }
}
