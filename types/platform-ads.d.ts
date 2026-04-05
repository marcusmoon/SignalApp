/** Metro가 .native / .web 등을 해석할 때 TS가 동일 경로로 타입을 잡도록 합니다. */
declare module '@/services/admob' {
  export function getGoogleMobileAdsModule():
    | import('react-native-google-mobile-ads')
    | null;
  export function getNativeAdUnitId(): string;
  export function getBannerAdUnitId(): string;
  export function initializeAds(): Promise<void>;
}

declare module '@/components/signal/AdPlaceholder' {
  import type { ReactElement } from 'react';
  export function AdPlaceholder(): ReactElement | null;
}

declare module '@/components/signal/SignalBannerAd' {
  import type { ReactElement } from 'react';
  export function SignalBannerAd(): ReactElement | null;
}
