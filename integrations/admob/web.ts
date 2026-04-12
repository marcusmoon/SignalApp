/** Web bundle does not load the Google Mobile Ads native module. */
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
