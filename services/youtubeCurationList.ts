import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';

const STORAGE_KEY = '@signal/youtube_curation_handles_v1';

const MAX_HANDLE_LEN = 100;

export function normalizeYoutubeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

/** YouTube 핸들에 가까운 형태만 허용 (공백·특수문자 최소화) */
export function isValidYoutubeHandle(handle: string): boolean {
  if (!handle || handle.length > MAX_HANDLE_LEN) return false;
  return /^[a-zA-Z0-9._-]+$/.test(handle);
}

function dedupePreserveOrder(handles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of handles) {
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out;
}

export async function loadCurationHandles(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
    const normalized = parsed
      .map((x) => (typeof x === 'string' ? normalizeYoutubeHandle(x) : ''))
      .filter((h) => h.length > 0 && isValidYoutubeHandle(h));
    const deduped = dedupePreserveOrder(normalized);
    return deduped.length > 0 ? deduped : [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
  } catch {
    return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
  }
}

export async function saveCurationHandles(handles: string[]): Promise<void> {
  const cleaned = dedupePreserveOrder(
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
