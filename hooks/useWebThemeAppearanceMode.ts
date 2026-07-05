import { useSyncExternalStore } from 'react';

import {
  readThemeAppearanceModeSync,
  THEME_APPEARANCE_CHANGED_EVENT,
  WEB_THEME_EFFECTIVE_SCHEME_KEY,
  type ThemeAppearanceMode,
} from '@/services/themeAppearancePreference';

const SERVER_SNAPSHOT: ThemeAppearanceMode = 'system';

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (
      event.key == null ||
      event.key.includes('theme_appearance') ||
      event.key === WEB_THEME_EFFECTIVE_SCHEME_KEY
    ) {
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

function getSnapshot(): ThemeAppearanceMode {
  return readThemeAppearanceModeSync();
}

function getServerSnapshot(): ThemeAppearanceMode {
  return SERVER_SNAPSHOT;
}

/** Web-only: read appearance mode from localStorage with SSR-safe hydration recovery. */
export function useWebThemeAppearanceMode(): ThemeAppearanceMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
