import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { MessageId } from '@/locales/messages';

/** 카탈로그(고정 목적지) 바로가기 */
export type HomeShortcutCatalogKey =
  | 'board'
  | 'quotes'
  | 'news'
  | 'newsIt'
  | 'calendar'
  | 'etf'
  | 'disclosures'
  | 'settings';

/** 홈 바로가기 — 보드 목록 또는 개별 게시글 포함 */
export type HomeShortcut =
  | { type: HomeShortcutCatalogKey }
  | { type: 'communityPost'; id: string; title?: string; source?: string };

export type HomeShortcutMeta = {
  key: HomeShortcutCatalogKey;
  icon: ComponentProps<typeof FontAwesome>['name'];
  titleId: MessageId;
};

/** 카탈로그 순 = 설정 토글 표시 순 */
export const HOME_SHORTCUT_CATALOG: HomeShortcutMeta[] = [
  { key: 'board', icon: 'comments', titleId: 'screenBoard' },
  { key: 'quotes', icon: 'line-chart', titleId: 'tabQuotes' },
  { key: 'news', icon: 'newspaper-o', titleId: 'tabNews' },
  { key: 'newsIt', icon: 'laptop', titleId: 'homeShortcutNewsIt' },
  { key: 'calendar', icon: 'calendar', titleId: 'ipadHomeCalendarTitle' },
  { key: 'etf', icon: 'pie-chart', titleId: 'moreHubEtfShort' },
  { key: 'disclosures', icon: 'file-text-o', titleId: 'tabDisclosures' },
  { key: 'settings', icon: 'cog', titleId: 'screenSettings' },
];

export const HOME_SHORTCUT_CATALOG_KEYS: HomeShortcutCatalogKey[] = HOME_SHORTCUT_CATALOG.map(
  (row) => row.key,
);

/** 기본: 보드 · 시세 · 뉴스 · 일정 */
export const HOME_SHORTCUTS_DEFAULT: HomeShortcut[] = [
  { type: 'board' },
  { type: 'quotes' },
  { type: 'news' },
  { type: 'calendar' },
];

export const HOME_SHORTCUTS_MAX = 6;

export function homeShortcutStableId(shortcut: HomeShortcut): string {
  return shortcut.type === 'communityPost' ? `communityPost:${shortcut.id}` : shortcut.type;
}

export function isHomeShortcutCatalogKey(value: string): value is HomeShortcutCatalogKey {
  return HOME_SHORTCUT_CATALOG_KEYS.includes(value as HomeShortcutCatalogKey);
}
