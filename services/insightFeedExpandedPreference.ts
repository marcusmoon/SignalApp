import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/insight_feed_expanded_v1';

export async function loadInsightFeedExpanded(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export async function saveInsightFeedExpanded(expanded: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
  } catch {
    /* ignore */
  }
}
