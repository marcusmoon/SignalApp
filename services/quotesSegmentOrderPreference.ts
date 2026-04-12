import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  normalizeQuotesSegmentOrder,
  QUOTES_SEGMENT_KEYS,
  type QuoteSegmentKey,
} from '@/domain/quotes/segmentOrder';

const STORAGE_KEY = '@signal/quotes_segment_order_v1';

export {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  QUOTES_SEGMENT_KEYS,
  type QuoteSegmentKey,
} from '@/domain/quotes/segmentOrder';

export async function loadQuotesSegmentOrder(): Promise<QuoteSegmentKey[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_QUOTES_SEGMENT_ORDER];
    const j = JSON.parse(raw) as unknown;
    return normalizeQuotesSegmentOrder(j);
  } catch {
    return [...DEFAULT_QUOTES_SEGMENT_ORDER];
  }
}

export async function saveQuotesSegmentOrder(order: QuoteSegmentKey[]): Promise<void> {
  const next = normalizeQuotesSegmentOrder(order);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
