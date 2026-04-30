import Constants from 'expo-constants';

/**
 * Expo: `.env`에 `EXPO_PUBLIC_*` 변수를 넣고 Metro를 재시작하면 주입됩니다.
 * 앱 피처 데이터는 Signal Server만 바라봅니다. 외부 provider 키는 서버/Admin에서 관리합니다.
 */
export const env = {
  signalApiBaseUrl: process.env.EXPO_PUBLIC_SIGNAL_API_BASE_URL ?? '',
  /** 비우면 AdMob 테스트 네이티브 단위 ID 사용 (네이티브 빌드만) */
  admobNativeUnitId: process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID ?? '',
  /** 비우면 AdMob 테스트 배너 단위 ID 사용 (네이티브 빌드만) */
  admobBannerUnitId: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID ?? '',
};

export function hasSignalApi() {
  return env.signalApiBaseUrl.trim().length > 0;
}

/** 앱 피처 데이터는 Signal Server(`EXPO_PUBLIC_SIGNAL_API_BASE_URL`)만 사용합니다. */
export function useSignalApiBackend() {
  return hasSignalApi();
}

/** OTA 미리보기 배너: manifest extra 우선(런타임 .env 반영), 없으면 번들 process.env */
export function getPreviewOtaBannerRaw(): string {
  const fromExtra = Constants.expoConfig?.extra?.previewOtaBanner;
  const fromEnv = process.env.EXPO_PUBLIC_PREVIEW_OTA_BANNER;
  const raw = fromExtra ?? fromEnv;
  return String(raw ?? '').trim();
}

/** __DEV__ 전용. '1' / 'true' / 'yes' 만 켜짐. 0·false·off·비우기·그 외는 끔 */
export function isPreviewOtaBannerEnabled(): boolean {
  if (!__DEV__) return false;
  const v = getPreviewOtaBannerRaw().toLowerCase();
  if (v === '' || v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return v === '1' || v === 'true' || v === 'yes';
}
