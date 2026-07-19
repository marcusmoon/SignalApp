import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { MessageId } from '@/locales/messages';

/** 홈 중간 바로가기 키 */
export type HomeShortcutKey =
  | 'board'
  | 'quotes'
  | 'news'
  | 'newsIt'
  | 'calendar'
  | 'etf'
  | 'disclosures'
  | 'settings';

export type HomeShortcutMeta = {
  key: HomeShortcutKey;
  icon: ComponentProps<typeof FontAwesome>['name'];
  titleId: MessageId;
};

/** 카탈로그 순 = 설정·스트립 표시 순 */
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

export const HOME_SHORTCUT_KEYS: HomeShortcutKey[] = HOME_SHORTCUT_CATALOG.map((row) => row.key);

/** 기본: 보드 · 시세 · 뉴스 · 일정 */
export const HOME_SHORTCUTS_DEFAULT: HomeShortcutKey[] = ['board', 'quotes', 'news', 'calendar'];

export const HOME_SHORTCUTS_MAX = 6;
