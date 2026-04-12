import AsyncStorage from '@react-native-async-storage/async-storage';

import { SIGNAL, buildAppTheme, type AppTheme } from '@/constants/theme';
import { CANONICAL_CUSTOM_ACCENT_FALLBACK, normalizeHex } from '@/domain/theme';

export const ACCENT_STORAGE_KEY = '@signal/accent_preset_v1';
export const ACCENT_CUSTOM_HEX_KEY = '@signal/accent_custom_hex_v1';

/** 기본 커스텀 액센트 (기존 로즈 프리셋과 동일) */
export const DEFAULT_CUSTOM_ACCENT_HEX = CANONICAL_CUSTOM_ACCENT_FALLBACK;

export type AccentPresetId =
  | 'green'
  | 'red'
  | 'blue'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'cyan'
  | 'teal'
  | 'pink'
  | 'lime'
  | 'indigo'
  | 'rose'
  | 'custom';

export const ACCENT_PRESETS: readonly { id: AccentPresetId; accent: string }[] = [
  { id: 'green', accent: '#00C087' },
  { id: 'red', accent: '#FF4D6D' },
  { id: 'blue', accent: '#3B82F6' },
  { id: 'yellow', accent: '#EAB308' },
  { id: 'orange', accent: '#F97316' },
  { id: 'purple', accent: '#A855F7' },
  { id: 'cyan', accent: '#06B6D4' },
  { id: 'teal', accent: '#14B8A6' },
  { id: 'pink', accent: '#EC4899' },
  { id: 'lime', accent: '#84CC16' },
  { id: 'indigo', accent: '#6366F1' },
  { id: 'rose', accent: '#F43F5E' },
];

const VALID_PRESET_IDS = new Set<string>([...ACCENT_PRESETS.map((p) => p.id), 'custom']);

export { hexToRgb, normalizeHex, rgbToHex } from '@/domain/theme';

export async function loadCustomAccentHex(): Promise<string> {
  const v = await AsyncStorage.getItem(ACCENT_CUSTOM_HEX_KEY);
  return normalizeHex(v) ?? DEFAULT_CUSTOM_ACCENT_HEX;
}

export async function saveCustomAccentHex(hex: string): Promise<void> {
  await AsyncStorage.setItem(ACCENT_CUSTOM_HEX_KEY, normalizeHex(hex) ?? DEFAULT_CUSTOM_ACCENT_HEX);
}

export async function loadAccentPreset(): Promise<AccentPresetId> {
  const v = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
  if (v && VALID_PRESET_IDS.has(v)) return v as AccentPresetId;
  return 'green';
}

export async function saveAccentPreset(id: AccentPresetId): Promise<void> {
  await AsyncStorage.setItem(ACCENT_STORAGE_KEY, id);
}

export function getThemeForPreset(id: AccentPresetId, customAccentHex?: string): AppTheme {
  if (id === 'custom') {
    const hex = normalizeHex(customAccentHex) ?? DEFAULT_CUSTOM_ACCENT_HEX;
    return buildAppTheme(hex);
  }
  const accent = ACCENT_PRESETS.find((p) => p.id === id)?.accent ?? SIGNAL.green;
  return buildAppTheme(accent);
}
