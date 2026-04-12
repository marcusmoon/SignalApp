import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeNewsSegmentOrder } from '@/domain/news';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import { NEWS_SEGMENT_ORDER } from '@/constants/newsSegment';

const STORAGE_KEY = '@signal/news_segment_order_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyNewsSegmentOrderChanged(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeNewsSegmentOrderChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadNewsSegmentOrder(): Promise<NewsSegmentKey[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [...NEWS_SEGMENT_ORDER];
    return normalizeNewsSegmentOrder(JSON.parse(stored) as unknown);
  } catch {
    return [...NEWS_SEGMENT_ORDER];
  }
}

export async function saveNewsSegmentOrder(order: NewsSegmentKey[]): Promise<void> {
  const next = normalizeNewsSegmentOrder(order);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notifyNewsSegmentOrderChanged();
}
