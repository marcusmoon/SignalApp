import { initializeAds } from '@/integrations/admob/initializeAds';
import { ensureStoredSessionFresh } from '@/integrations/signal-api/httpClient';
import { syncStoredAppIconVariant } from '@/services/appIconPreference';
import {
  loadAccentPreset,
  loadCustomAccentHex,
} from '@/services/accentPreference';
import { loadFeedContentWeight } from '@/services/feedContentWeightPreference';
import { loadFontSizePreset } from '@/services/fontSizePreference';
import { loadLocale } from '@/services/localePreference';
import { loadMainEntry } from '@/services/mainEntryPreference';
import { hydrateSignalServerEndpoint } from '@/services/signalServerEndpoint';
import { loadThemeAppearanceMode } from '@/services/themeAppearancePreference';

/** 스플래시 최소 표시 시간(ms). 이 값은 여기서만 조정합니다. */
export const SPLASH_MIN_DISPLAY_MS = 1000;

async function preloadUserPreferences(): Promise<void> {
  await Promise.all([
    loadLocale(),
    loadThemeAppearanceMode(),
    loadAccentPreset(),
    loadCustomAccentHex(),
    loadFontSizePreset(),
    loadFeedContentWeight(),
  ]);
}

/** 앱 기동 시 스플래시가 보이는 동안 실행할 초기화. */
export async function runAppBootstrap(): Promise<void> {
  await Promise.all([
    hydrateSignalServerEndpoint(),
    loadMainEntry(),
    ensureStoredSessionFresh(),
    syncStoredAppIconVariant(),
    preloadUserPreferences(),
  ]);

  // 광고 SDK는 실패해도 앱 진입을 막지 않음.
  void initializeAds().catch(() => {});
}
