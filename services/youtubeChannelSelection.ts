import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/youtube_selected_channels_v1';

export async function loadSelectedChannels(availableHandles: string[]): Promise<string[]> {
  if (availableHandles.length === 0) return [];
  const valid = new Set(availableHandles);
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...availableHandles];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...availableHandles];
    if (parsed.length === 0) return [];
    const filtered = parsed.filter((h): h is string => typeof h === 'string' && valid.has(h));
    return filtered;
  } catch {
    return [...availableHandles];
  }
}

export async function saveSelectedChannels(handles: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
}

/** 큐레이션 목록이 바뀐 뒤 선택값을 유효한 핸들만 남기고 정리합니다. */
export async function reconcileSelectedChannels(validHandles: string[]): Promise<void> {
  const valid = new Set(validHandles);
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await saveSelectedChannels([...validHandles]);
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      await saveSelectedChannels([...validHandles]);
      return;
    }
    if (parsed.length === 0) {
      await saveSelectedChannels([]);
      return;
    }
    const filtered = parsed.filter((h): h is string => typeof h === 'string' && valid.has(h));
    await saveSelectedChannels(filtered);
  } catch {
    await saveSelectedChannels([...validHandles]);
  }
}
