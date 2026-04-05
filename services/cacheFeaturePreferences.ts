import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/cache_features_v1';

export type CacheFeaturePrefs = {
  youtubeEnabled: boolean;
  concallEnabled: boolean;
  calendarEnabled: boolean;
  /** 시세 탭(관심·인기·시총·코인) 메모리 캐시 */
  quotesEnabled: boolean;
  /** 뉴스 탭 Finnhub 원문 메모리 캐시 */
  newsEnabled: boolean;
};

const DEFAULTS: CacheFeaturePrefs = {
  youtubeEnabled: true,
  concallEnabled: true,
  calendarEnabled: true,
  quotesEnabled: true,
  newsEnabled: true,
};

export async function loadCacheFeaturePrefs(): Promise<CacheFeaturePrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw) as Partial<CacheFeaturePrefs>;
    return {
      youtubeEnabled: typeof j.youtubeEnabled === 'boolean' ? j.youtubeEnabled : DEFAULTS.youtubeEnabled,
      concallEnabled: typeof j.concallEnabled === 'boolean' ? j.concallEnabled : DEFAULTS.concallEnabled,
      calendarEnabled: typeof j.calendarEnabled === 'boolean' ? j.calendarEnabled : DEFAULTS.calendarEnabled,
      quotesEnabled: typeof j.quotesEnabled === 'boolean' ? j.quotesEnabled : DEFAULTS.quotesEnabled,
      newsEnabled: typeof j.newsEnabled === 'boolean' ? j.newsEnabled : DEFAULTS.newsEnabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveCacheFeaturePrefs(partial: Partial<CacheFeaturePrefs>): Promise<void> {
  const current = await loadCacheFeaturePrefs();
  const next: CacheFeaturePrefs = { ...current, ...partial };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
