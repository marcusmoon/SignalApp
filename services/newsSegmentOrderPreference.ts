import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NewsSegmentKey } from '@/constants/newsSegment';
import { NEWS_SEGMENT_ORDER } from '@/constants/newsSegment';

const STORAGE_KEY = '@signal/news_segment_order_v1';

const ALL_KEYS: NewsSegmentKey[] = ['global', 'korea', 'crypto'];

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

function normalizeOrder(raw: unknown): NewsSegmentKey[] {
  if (!Array.isArray(raw)) return [...NEWS_SEGMENT_ORDER];
  const out: NewsSegmentKey[] = [];
  const seen = new Set<NewsSegmentKey>();
  for (const x of raw) {
    if (ALL_KEYS.includes(x as NewsSegmentKey) && !seen.has(x as NewsSegmentKey)) {
      out.push(x as NewsSegmentKey);
      seen.add(x as NewsSegmentKey);
    }
  }
  for (const k of NEWS_SEGMENT_ORDER) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

export async function loadNewsSegmentOrder(): Promise<NewsSegmentKey[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [...NEWS_SEGMENT_ORDER];
    return normalizeOrder(JSON.parse(stored) as unknown);
  } catch {
    return [...NEWS_SEGMENT_ORDER];
  }
}

export async function saveNewsSegmentOrder(order: NewsSegmentKey[]): Promise<void> {
  const next = normalizeOrder(order);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notifyNewsSegmentOrderChanged();
}
