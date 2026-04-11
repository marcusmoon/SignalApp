import Constants from 'expo-constants';

/**
 * Expo: `.env`에 `EXPO_PUBLIC_*` 변수를 넣고 Metro를 재시작하면 주입됩니다.
 * 프로덕션에서는 Anthropic/Finnhub 키는 서버(BFF)에 두는 것이 안전합니다.
 */
export const env = {
  finnhubToken: process.env.EXPO_PUBLIC_FINNHUB_TOKEN ?? '',
  anthropicKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  openaiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '',
  youtubeKey: process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '',
  apiNinjasKey: process.env.EXPO_PUBLIC_API_NINJAS_KEY ?? '',
  /** 비우면 AdMob 테스트 네이티브 단위 ID 사용 (네이티브 빌드만) */
  admobNativeUnitId: process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID ?? '',
  /** 비우면 AdMob 테스트 배너 단위 ID 사용 (네이티브 빌드만) */
  admobBannerUnitId: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID ?? '',
};

export function hasFinnhub() {
  return env.finnhubToken.length > 0;
}

export function hasAnthropic() {
  return env.anthropicKey.length > 0;
}

export function hasOpenAI() {
  return env.openaiKey.length > 0;
}

export function hasYoutube() {
  return env.youtubeKey.length > 0;
}

export function hasApiNinjas() {
  return env.apiNinjasKey.length > 0;
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
