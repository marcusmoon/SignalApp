import AsyncStorage from '@react-native-async-storage/async-storage';

import { SIGNAL, buildAppTheme, type AppTheme } from '@/constants/theme';

export const ACCENT_STORAGE_KEY = '@signal/accent_preset_v1';

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
  | 'rose';

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

const PRESET_IDS = new Set(ACCENT_PRESETS.map((p) => p.id));

export async function loadAccentPreset(): Promise<AccentPresetId> {
  const v = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
  if (v && PRESET_IDS.has(v as AccentPresetId)) return v as AccentPresetId;
  return 'green';
}

export async function saveAccentPreset(id: AccentPresetId): Promise<void> {
  await AsyncStorage.setItem(ACCENT_STORAGE_KEY, id);
}

export function getThemeForPreset(id: AccentPresetId): AppTheme {
  const accent = ACCENT_PRESETS.find((p) => p.id === id)?.accent ?? SIGNAL.green;
  return buildAppTheme(accent);
}
