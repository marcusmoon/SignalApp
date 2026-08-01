import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import {
  COMMUNITY_SOURCE_ALL,
  COMMUNITY_SOURCE_ORDER,
  type CommunitySourceFilter,
} from '@/constants/communitySources';
import { NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import { QUOTES_SEGMENT_KEYS, type QuoteSegmentKey } from '@/domain/quotes/constants';

/** 홈 바로가기 — 같은 상위(보드/시세/뉴스)라도 하위 타깃을 여러 개 둘 수 있음 */
export type HomeShortcut =
  | { type: 'board'; source: CommunitySourceFilter }
  | { type: 'quotes'; segment: QuoteSegmentKey }
  | { type: 'news'; segment: NewsSegmentKey }
  | { type: 'calendar' }
  | { type: 'etf' }
  | { type: 'disclosures' }
  | { type: 'settings' };

export type HomeShortcutSimpleType = 'calendar' | 'etf' | 'disclosures' | 'settings';

export type HomeShortcutOption =
  | { type: 'board'; source: CommunitySourceFilter }
  | { type: 'quotes'; segment: QuoteSegmentKey }
  | { type: 'news'; segment: NewsSegmentKey }
  | { type: HomeShortcutSimpleType };

/** 설정·스트립용 아이콘 */
export const HOME_SHORTCUT_TYPE_ICON: Record<
  HomeShortcut['type'],
  ComponentProps<typeof FontAwesome>['name']
> = {
  board: 'comments',
  quotes: 'line-chart',
  news: 'newspaper-o',
  calendar: 'calendar',
  etf: 'pie-chart',
  disclosures: 'file-text-o',
  settings: 'cog',
};

/** 추가 가능한 옵션 — 카탈로그 순 */
export const HOME_SHORTCUT_OPTIONS: HomeShortcutOption[] = [
  ...COMMUNITY_SOURCE_ORDER.map((source) => ({ type: 'board' as const, source })),
  ...QUOTES_SEGMENT_KEYS.map((segment) => ({ type: 'quotes' as const, segment })),
  ...NEWS_SEGMENT_ORDER.map((segment) => ({ type: 'news' as const, segment })),
  { type: 'calendar' },
  { type: 'etf' },
  { type: 'disclosures' },
  { type: 'settings' },
];

/** 기본: 보드(전체) · 시세(관심) · 뉴스(전체) · 일정 */
export const HOME_SHORTCUTS_DEFAULT: HomeShortcut[] = [
  { type: 'board', source: COMMUNITY_SOURCE_ALL },
  { type: 'quotes', segment: 'watch' },
  { type: 'news', segment: 'all' },
  { type: 'calendar' },
];

export const HOME_SHORTCUTS_MAX = 6;

export function homeShortcutStableId(shortcut: HomeShortcut): string {
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

export function homeShortcutOptionStableId(option: HomeShortcutOption): string {
  return homeShortcutStableId(option as HomeShortcut);
}
