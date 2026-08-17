/**
 * 홈 바로가기 저장값 정규화 — 레거시 마이그레이션 · 최대 6 · 중복 제거.
 * constants/아이콘 의존 없이 회귀 테스트 가능.
 */

export const HOME_SHORTCUTS_MAX = 6;

export type NormalizedHomeShortcut =
  | { type: 'board'; source: string }
  | { type: 'quotes'; segment: string }
  | { type: 'news'; segment: string }
  | { type: 'calendar' }
  | { type: 'etf' }
  | { type: 'disclosures' }
  | { type: 'settings' };

const BOARD_SOURCES = new Set([
  'all',
  'save_user_news',
  'naver_likeusstock_free',
  'naver_yamizal_free',
  'motley_fool_investing',
]);
const QUOTE_SEGMENTS = new Set(['watch', 'etf', 'coin']);
const NEWS_SEGMENTS = new Set(['all', 'global', 'korea', 'crypto', 'it', 'video']);

function migrateQuotesSegment(raw: string): string {
  if (raw === 'popular' || raw === 'mcap') return 'etf';
  return raw;
}

export const HOME_SHORTCUTS_DEFAULT_NORMALIZED: NormalizedHomeShortcut[] = [
  { type: 'board', source: 'all' },
  { type: 'quotes', segment: 'watch' },
  { type: 'news', segment: 'all' },
  { type: 'calendar' },
];

export function homeShortcutStableIdNormalized(shortcut: NormalizedHomeShortcut): string {
  switch (shortcut.type) {
    case 'board':
      return `board:${shortcut.source}`;
    case 'quotes':
      return `quotes:${shortcut.segment}`;
    case 'news':
      return `news:${shortcut.segment}`;
    default:
      return shortcut.type;
  }
}

function migrateLegacyString(raw: string): NormalizedHomeShortcut | null {
  switch (raw) {
    case 'board':
      return { type: 'board', source: 'all' };
    case 'quotes':
      return { type: 'quotes', segment: 'watch' };
    case 'news':
      return { type: 'news', segment: 'all' };
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

function parseHomeShortcut(raw: unknown): NormalizedHomeShortcut | null {
  if (typeof raw === 'string') return migrateLegacyString(raw);
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { type?: unknown; source?: unknown; segment?: unknown };
  const type = String(row.type || '').trim();

  if (type === 'communityPost') return null;
  if (type === 'newsIt') return { type: 'news', segment: 'it' };

  if (type === 'board') {
    const source = String(row.source || '').trim();
    return { type: 'board', source: BOARD_SOURCES.has(source) ? source : 'all' };
  }
  if (type === 'quotes') {
    const segment = migrateQuotesSegment(String(row.segment || '').trim());
    return { type: 'quotes', segment: QUOTE_SEGMENTS.has(segment) ? segment : 'watch' };
  }
  if (type === 'news') {
    const segment = String(row.segment || '').trim();
    return { type: 'news', segment: NEWS_SEGMENTS.has(segment) ? segment : 'all' };
  }
  if (type === 'calendar' || type === 'etf' || type === 'disclosures' || type === 'settings') {
    return { type };
  }
  return null;
}

/** 저장된 배열 정규화. `[]`는 빈 스트립. 비배열은 기본값. */
export function normalizeHomeShortcutsRaw(raw: unknown): NormalizedHomeShortcut[] {
  if (!Array.isArray(raw)) return HOME_SHORTCUTS_DEFAULT_NORMALIZED.map((row) => ({ ...row }));
  const out: NormalizedHomeShortcut[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = parseHomeShortcut(item);
    if (!parsed) continue;
    const id = homeShortcutStableIdNormalized(parsed);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(parsed);
    if (out.length >= HOME_SHORTCUTS_MAX) break;
  }
  return out;
}

export function addHomeShortcutRaw(
  current: NormalizedHomeShortcut[],
  shortcut: NormalizedHomeShortcut,
): NormalizedHomeShortcut[] {
  const id = homeShortcutStableIdNormalized(shortcut);
  if (current.some((row) => homeShortcutStableIdNormalized(row) === id)) return current;
  if (current.length >= HOME_SHORTCUTS_MAX) return current;
  return [...current, shortcut];
}
