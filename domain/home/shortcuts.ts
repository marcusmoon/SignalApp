import {
  COMMUNITY_SOURCE_ALL,
  COMMUNITY_SOURCE_ORDER,
  type CommunitySourceFilter,
} from '@/constants/communitySources';
import {
  HOME_SHORTCUTS_DEFAULT,
  HOME_SHORTCUTS_MAX,
  homeShortcutStableId,
  type HomeShortcut,
  type HomeShortcutOption,
} from '@/constants/homeShortcuts';
import { NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import { QUOTES_SEGMENT_KEYS, type QuoteSegmentKey } from '@/domain/quotes/constants';

const NEWS_SET = new Set<string>(NEWS_SEGMENT_ORDER);
const QUOTES_SET = new Set<string>(QUOTES_SEGMENT_KEYS);
const BOARD_SET = new Set<string>(COMMUNITY_SOURCE_ORDER);

function parseNewsSegment(value: unknown): NewsSegmentKey | null {
  const key = String(value || '').trim();
  return NEWS_SET.has(key) ? (key as NewsSegmentKey) : null;
}

function parseQuotesSegment(value: unknown): QuoteSegmentKey | null {
  const key = String(value || '').trim();
  return QUOTES_SET.has(key) ? (key as QuoteSegmentKey) : null;
}

function parseBoardSource(value: unknown): CommunitySourceFilter | null {
  const key = String(value || '').trim();
  return BOARD_SET.has(key) ? (key as CommunitySourceFilter) : null;
}

function migrateLegacyString(raw: string): HomeShortcut | null {
  switch (raw) {
    case 'board':
      return { type: 'board', source: COMMUNITY_SOURCE_ALL };
    case 'quotes':
      return { type: 'quotes', segment: 'watch' };
    case 'news':
      return { type: 'news', segment: 'global' };
    case 'newsIt':
      return { type: 'news', segment: 'it' };
    case 'calendar':
    case 'etf':
    case 'disclosures':
    case 'settings':
      return { type: raw };
    default:
      return null;
  }
}

function parseHomeShortcut(raw: unknown): HomeShortcut | null {
  if (typeof raw === 'string') return migrateLegacyString(raw);
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as {
    type?: unknown;
    id?: unknown;
    title?: unknown;
    source?: unknown;
    segment?: unknown;
  };
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

  if (type === 'newsIt') return { type: 'news', segment: 'it' };

  if (type === 'board') {
    const source = parseBoardSource(row.source) ?? COMMUNITY_SOURCE_ALL;
    return { type: 'board', source };
  }

  if (type === 'quotes') {
    const segment = parseQuotesSegment(row.segment) ?? 'watch';
    return { type: 'quotes', segment };
  }

  if (type === 'news') {
    const segment = parseNewsSegment(row.segment) ?? 'global';
    return { type: 'news', segment };
  }

  if (type === 'calendar' || type === 'etf' || type === 'disclosures' || type === 'settings') {
    return { type };
  }

  return null;
}

/** 저장된 배열 정규화. 레거시 string[]·구 객체도 수용. `[]`는 빈 스트립. */
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

export function hasHomeShortcut(
  current: HomeShortcut[],
  candidate: HomeShortcut | HomeShortcutOption,
): boolean {
  const id = homeShortcutStableId(candidate as HomeShortcut);
  return current.some((row) => homeShortcutStableId(row) === id);
}

export function addHomeShortcut(
  current: HomeShortcut[],
  shortcut: HomeShortcut | HomeShortcutOption,
): HomeShortcut[] {
  if (hasHomeShortcut(current, shortcut)) return normalizeHomeShortcuts(current);
  if (current.length >= HOME_SHORTCUTS_MAX) return normalizeHomeShortcuts(current);
  return normalizeHomeShortcuts([...current, shortcut as HomeShortcut]);
}

export function removeHomeShortcut(
  current: HomeShortcut[],
  shortcut: HomeShortcut | HomeShortcutOption | string,
): HomeShortcut[] {
  const id =
    typeof shortcut === 'string' ? shortcut : homeShortcutStableId(shortcut as HomeShortcut);
  return normalizeHomeShortcuts(current.filter((row) => homeShortcutStableId(row) !== id));
}

export function toggleHomeShortcutOption(
  current: HomeShortcut[],
  option: HomeShortcutOption,
  enabled: boolean,
): HomeShortcut[] {
  return enabled ? addHomeShortcut(current, option) : removeHomeShortcut(current, option);
}

export function reorderHomeShortcuts(next: HomeShortcut[]): HomeShortcut[] {
  return normalizeHomeShortcuts(next);
}

export function addHomeCommunityPostShortcut(
  current: HomeShortcut[],
  post: { id: string; title?: string; source?: string },
): HomeShortcut[] {
  const id = String(post.id || '').trim();
  if (!id) return normalizeHomeShortcuts(current);
  const title = String(post.title || '').trim();
  const source = String(post.source || '').trim();
  return addHomeShortcut(current, {
    type: 'communityPost',
    id,
    ...(title ? { title } : null),
    ...(source ? { source } : null),
  });
}

export function listHomeCommunityPostShortcuts(
  current: HomeShortcut[],
): Extract<HomeShortcut, { type: 'communityPost' }>[] {
  return current.filter(
    (row): row is Extract<HomeShortcut, { type: 'communityPost' }> => row.type === 'communityPost',
  );
}
