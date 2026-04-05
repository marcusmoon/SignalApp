/** 웹 번들에서는 Google Mobile Ads 네이티브 모듈을 로드하지 않습니다. */
export function getGoogleMobileAdsModule(): null {
  return null;
}

export function getNativeAdUnitId(): string {
  return '';
}

export function getBannerAdUnitId(): string {
  return '';
}

export async function initializeAds(): Promise<void> {}
