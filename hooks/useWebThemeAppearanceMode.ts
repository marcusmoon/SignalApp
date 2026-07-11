import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import {
  readThemeAppearanceModeSync,
  THEME_APPEARANCE_CHANGED_EVENT,
  type ThemeAppearanceMode,
} from '@/services/themeAppearancePreference';

const SERVER_SNAPSHOT: ThemeAppearanceMode = 'system';

function noopSubscribe(_onStoreChange: () => void): () => void {
  return () => {};
}

function subscribeWeb(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key == null || event.key.includes('theme_appearance')) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_APPEARANCE_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_APPEARANCE_CHANGED_EVENT, onStoreChange);
  };
}

function getWebSnapshot(): ThemeAppearanceMode {
  return readThemeAppearanceModeSync();
}

function getNativeSnapshot(): ThemeAppearanceMode {
  return SERVER_SNAPSHOT;
}

/** Web-only store read; native uses a no-op subscribe so hooks order stays stable. */
export function useWebThemeAppearanceMode(): ThemeAppearanceMode {
  const isWeb = Platform.OS === 'web';
  return useSyncExternalStore(
    isWeb ? subscribeWeb : noopSubscribe,
    isWeb ? getWebSnapshot : getNativeSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
