import {
  HOME_SHORTCUTS_DEFAULT,
  HOME_SHORTCUTS_MAX,
  homeShortcutStableId,
  isHomeShortcutCatalogKey,
  type HomeShortcut,
  type HomeShortcutCatalogKey,
} from '@/constants/homeShortcuts';

function parseHomeShortcut(raw: unknown): HomeShortcut | null {
  if (typeof raw === 'string') {
    if (!isHomeShortcutCatalogKey(raw)) return null;
    return { type: raw };
  }
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { type?: unknown; id?: unknown; title?: unknown; source?: unknown };
  const type = String(row.type || '').trim();
  if (type === 'communityPost') {
    const id = String(row.id || '').trim();
    if (!id) return null;
    const title = String(row.title || '').trim();
    const source = String(row.source || '').trim();
    return {
      type: 'communityPost',
      id,
      ...(title ? { title } : null),
      ...(source ? { source } : null),
    };
  }
  if (!isHomeShortcutCatalogKey(type)) return null;
  return { type };
}

/** 저장된 배열 정규화. 레거시 string[]도 수용. `[]`는 빈 스트립. */
export function normalizeHomeShortcuts(raw: unknown): HomeShortcut[] {
  if (!Array.isArray(raw)) return HOME_SHORTCUTS_DEFAULT.map((row) => ({ ...row }));
  const out: HomeShortcut[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = parseHomeShortcut(item);
    if (!parsed) continue;
    const id = homeShortcutStableId(parsed);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(parsed);
    if (out.length >= HOME_SHORTCUTS_MAX) break;
  }
  return out;
}

export function hasHomeShortcutCatalog(
  current: HomeShortcut[],
  key: HomeShortcutCatalogKey,
): boolean {
  return current.some((row) => row.type === key);
}

export function toggleHomeShortcutCatalog(
  current: HomeShortcut[],
  key: HomeShortcutCatalogKey,
  enabled: boolean,
): HomeShortcut[] {
  if (enabled) {
    if (hasHomeShortcutCatalog(current, key)) return normalizeHomeShortcuts(current);
    if (current.length >= HOME_SHORTCUTS_MAX) return normalizeHomeShortcuts(current);
    return normalizeHomeShortcuts([...current, { type: key }]);
  }
  return normalizeHomeShortcuts(current.filter((row) => row.type !== key));
}

export function addHomeCommunityPostShortcut(
  current: HomeShortcut[],
  post: { id: string; title?: string; source?: string },
): HomeShortcut[] {
  const id = String(post.id || '').trim();
  if (!id) return normalizeHomeShortcuts(current);
  if (current.some((row) => row.type === 'communityPost' && row.id === id)) {
    return normalizeHomeShortcuts(current);
  }
  if (current.length >= HOME_SHORTCUTS_MAX) return normalizeHomeShortcuts(current);
  const title = String(post.title || '').trim();
  const source = String(post.source || '').trim();
  return normalizeHomeShortcuts([
    ...current,
    {
      type: 'communityPost',
      id,
      ...(title ? { title } : null),
      ...(source ? { source } : null),
    },
  ]);
}

export function removeHomeCommunityPostShortcut(
  current: HomeShortcut[],
  postId: string,
): HomeShortcut[] {
  const id = String(postId || '').trim();
  return normalizeHomeShortcuts(
    current.filter((row) => !(row.type === 'communityPost' && row.id === id)),
  );
}

export function listHomeCommunityPostShortcuts(
  current: HomeShortcut[],
): Extract<HomeShortcut, { type: 'communityPost' }>[] {
  return current.filter(
    (row): row is Extract<HomeShortcut, { type: 'communityPost' }> => row.type === 'communityPost',
  );
}
