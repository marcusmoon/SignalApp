import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/font_size_preset_v1';

export type FontSizePresetId = 'compact' | 'standard' | 'comfortable';

const VALID = new Set<string>(['compact', 'standard', 'comfortable']);

/** UI 전역에 곱하는 배율 (1 = 기존 PRD 기준) */
export const FONT_SIZE_PRESET_MULTIPLIER: Record<FontSizePresetId, number> = {
  compact: 0.9,
  standard: 1,
  comfortable: 1.12,
};

export function fontSizeMultiplierForPreset(id: FontSizePresetId): number {
  return FONT_SIZE_PRESET_MULTIPLIER[id] ?? 1;
}

export async function loadFontSizePreset(): Promise<FontSizePresetId> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  if (v && VALID.has(v)) return v as FontSizePresetId;
  return 'standard';
}

export async function saveFontSizePreset(id: FontSizePresetId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, id);
}
