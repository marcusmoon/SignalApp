import {
  HOME_SHORTCUT_KEYS,
  HOME_SHORTCUTS_DEFAULT,
  HOME_SHORTCUTS_MAX,
  type HomeShortcutKey,
} from '@/constants/homeShortcuts';

const KEY_SET = new Set<string>(HOME_SHORTCUT_KEYS);

function isHomeShortcutKey(value: unknown): value is HomeShortcutKey {
  return typeof value === 'string' && KEY_SET.has(value);
}

/** 저장된 배열을 카탈로그 순·중복 제거·최대 개수로 정규화. `[]`는 빈 스트립. */
export function normalizeHomeShortcuts(raw: unknown): HomeShortcutKey[] {
  if (!Array.isArray(raw)) return [...HOME_SHORTCUTS_DEFAULT];
  const selected = new Set<HomeShortcutKey>();
  for (const item of raw) {
    if (isHomeShortcutKey(item)) selected.add(item);
  }
  return HOME_SHORTCUT_KEYS.filter((key) => selected.has(key)).slice(0, HOME_SHORTCUTS_MAX);
}

export function toggleHomeShortcut(
  current: HomeShortcutKey[],
  key: HomeShortcutKey,
  enabled: boolean,
): HomeShortcutKey[] {
  if (enabled) {
    if (current.includes(key)) return normalizeHomeShortcuts(current);
    if (current.length >= HOME_SHORTCUTS_MAX) return normalizeHomeShortcuts(current);
    return normalizeHomeShortcuts([...current, key]);
  }
  return normalizeHomeShortcuts(current.filter((row) => row !== key));
}
