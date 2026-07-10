import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/news_feed_layout_v1';

/** `legacy`: 기사 피드(기존), `digest`: 이슈 요약 중심(신규) */
export type NewsFeedLayout = 'legacy' | 'digest';

export const DEFAULT_NEWS_FEED_LAYOUT: NewsFeedLayout = 'legacy';

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeNewsFeedLayoutChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function isNewsFeedLayout(value: unknown): value is NewsFeedLayout {
  return value === 'legacy' || value === 'digest';
}

export async function loadNewsFeedLayout(): Promise<NewsFeedLayout> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NEWS_FEED_LAYOUT;
    const parsed = JSON.parse(raw);
    return isNewsFeedLayout(parsed) ? parsed : DEFAULT_NEWS_FEED_LAYOUT;
  } catch {
    return DEFAULT_NEWS_FEED_LAYOUT;
  }
}

export async function saveNewsFeedLayout(layout: NewsFeedLayout): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
  notify();
}
