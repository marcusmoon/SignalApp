import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NewsSegmentKey } from '@/constants/newsSegment';
import { DEFAULT_NEWS_SEGMENT } from '@/constants/newsSegment';

const STORAGE_KEY = '@signal/news_segment_v1';

const ALLOWED = new Set<NewsSegmentKey>(['global', 'korea', 'crypto']);

export async function loadNewsSegment(): Promise<NewsSegmentKey> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw && ALLOWED.has(raw as NewsSegmentKey)) return raw as NewsSegmentKey;
  } catch {
    /* ignore */
  }
  return DEFAULT_NEWS_SEGMENT;
}

export async function saveNewsSegment(segment: NewsSegmentKey): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, segment);
  } catch {
    /* ignore */
  }
}
