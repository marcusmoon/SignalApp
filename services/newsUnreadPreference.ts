import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SEEN_KEY = '@signal/news_last_seen_id_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeNewsSeenChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadLastSeenNewsId(): Promise<string | null> {
  const v = await AsyncStorage.getItem(LAST_SEEN_KEY);
  return v && v.trim() ? v.trim() : null;
}

export async function saveLastSeenNewsId(id: string): Promise<void> {
  if (!id.trim()) return;
  await AsyncStorage.setItem(LAST_SEEN_KEY, id.trim());
  notify();
}
