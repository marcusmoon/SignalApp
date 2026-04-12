import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';
import {
  dedupeStringsPreserveOrder,
  isValidYoutubeHandle,
  normalizeYoutubeHandle,
} from '@/domain/youtube/handle';

const STORAGE_KEY = '@signal/youtube_curation_handles_v1';

export {
  isValidYoutubeHandle,
  normalizeYoutubeHandle,
} from '@/domain/youtube/handle';

export async function loadCurationHandles(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
    const normalized = parsed
      .map((x) => (typeof x === 'string' ? normalizeYoutubeHandle(x) : ''))
      .filter((h) => h.length > 0 && isValidYoutubeHandle(h));
    const deduped = dedupeStringsPreserveOrder(normalized);
    return deduped.length > 0 ? deduped : [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
  } catch {
    return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
  }
}

export async function saveCurationHandles(handles: string[]): Promise<void> {
  const cleaned = dedupeStringsPreserveOrder(
    handles.map(normalizeYoutubeHandle).filter((h) => h.length > 0 && isValidYoutubeHandle(h)),
  );
  const toStore = cleaned.length > 0 ? cleaned : [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export async function resetCurationToDefaults(): Promise<string[]> {
  const next = [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
