import { getExpoUpdatesModule } from './client';

/**
 * EAS Update 등으로 번들이 새로 올라왔는지 확인.
 * 네이티브 모듈 없음 / 비활성 / __DEV__ 시 false.
 */
export async function checkOtaAvailable(): Promise<boolean> {
  if (__DEV__) return false;
  const Updates = getExpoUpdatesModule();
  if (!Updates?.isEnabled) return false;
  try {
    const result = await Updates.checkForUpdateAsync();
    return result.isAvailable === true;
  } catch {
    return false;
  }
}

/**
 * 새 번들을 받은 뒤 앱을 재시작. 실패 시 Error throw.
 */
export async function fetchAndReloadOta(): Promise<void> {
  const Updates = getExpoUpdatesModule();
  if (!Updates?.isEnabled) {
    throw new Error('OTA_DISABLED');
  }
  const result = await Updates.fetchUpdateAsync();
  if (result.isNew) {
    await Updates.reloadAsync();
    return;
  }
  throw new Error('OTA_FETCH_NOT_NEW');
}
