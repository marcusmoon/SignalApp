import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/news_selected_sources_v1';

export async function loadSelectedSources(availableSources: string[]): Promise<string[]> {
  if (availableSources.length === 0) return [];
  const valid = new Set(availableSources);
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...availableSources];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...availableSources];
    const filtered = parsed.filter((s): s is string => typeof s === 'string' && valid.has(s));
    // If new sources appear later (e.g. Financial Juice), include them by default so users
    // don't "miss" newly ingested feeds due to old saved filters.
    const selected = filtered.length > 0 ? filtered : [];
    const out = [...selected];
    for (const s of availableSources) {
      if (!out.includes(s)) out.push(s);
    }
    return out.length > 0 ? out : [...availableSources];
  } catch {
    return [...availableSources];
  }
}

export async function saveSelectedSources(sources: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}
