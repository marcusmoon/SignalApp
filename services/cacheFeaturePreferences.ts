import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/cache_features_v1';

export type CacheFeaturePrefs = {
  youtubeEnabled: boolean;
  concallEnabled: boolean;
};

const DEFAULTS: CacheFeaturePrefs = {
  youtubeEnabled: true,
  concallEnabled: true,
};

export async function loadCacheFeaturePrefs(): Promise<CacheFeaturePrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw) as Partial<CacheFeaturePrefs>;
    return {
      youtubeEnabled: typeof j.youtubeEnabled === 'boolean' ? j.youtubeEnabled : DEFAULTS.youtubeEnabled,
      concallEnabled: typeof j.concallEnabled === 'boolean' ? j.concallEnabled : DEFAULTS.concallEnabled,
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
