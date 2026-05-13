type UpdatesNs = typeof import('expo-updates');

/** 네이티브에 ExpoUpdates가 없으면 require 단계에서 실패 — 전역 import 금지 */
let updatesCache: UpdatesNs | null | undefined;

export function getExpoUpdatesModule(): UpdatesNs | null {
  if (updatesCache !== undefined) return updatesCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    updatesCache = require('expo-updates') as UpdatesNs;
    return updatesCache;
  } catch {
    updatesCache = null;
    return null;
  }
}
