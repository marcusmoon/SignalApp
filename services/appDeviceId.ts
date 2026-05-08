import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@signal/app_device_id_v1';

/** Stable per-install id for JWT refresh binding (8+ chars). */
export async function getOrCreateAppDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing && existing.length >= 8) return existing;
  const id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  await AsyncStorage.setItem(KEY, id);
  return id;
}
