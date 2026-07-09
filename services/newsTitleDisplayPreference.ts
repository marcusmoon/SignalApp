import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/news_title_display_mode_v1';

/** `localized`: 앱 로케일 기본 제목, `alternate`: 원문·번역 대체 제목 */
export type NewsTitleDisplayMode = 'localized' | 'alternate';

export const DEFAULT_NEWS_TITLE_DISPLAY_MODE: NewsTitleDisplayMode = 'localized';

export function isNewsTitleDisplayMode(value: unknown): value is NewsTitleDisplayMode {
  return value === 'localized' || value === 'alternate';
}

export async function loadNewsTitleDisplayMode(): Promise<NewsTitleDisplayMode> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NEWS_TITLE_DISPLAY_MODE;
    const parsed = JSON.parse(raw);
    return isNewsTitleDisplayMode(parsed) ? parsed : DEFAULT_NEWS_TITLE_DISPLAY_MODE;
  } catch {
    return DEFAULT_NEWS_TITLE_DISPLAY_MODE;
  }
}

export async function saveNewsTitleDisplayMode(mode: NewsTitleDisplayMode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
  } catch {
    /* ignore */
  }
}
