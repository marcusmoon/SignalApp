import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import {
  HOME_SHORTCUT_TYPE_ICON,
  type HomeShortcut,
  type HomeShortcutOption,
} from '@/constants/homeShortcuts';
import { COMMUNITY_SOURCE_ALL } from '@/constants/communitySources';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import type { QuoteSegmentKey } from '@/domain/quotes/constants';
import type { MessageId } from '@/locales/messages';

import { homeShortcutCompoundLabel } from '@/domain/home/shortcutCompoundLabel';

export { homeShortcutCompoundLabel } from '@/domain/home/shortcutCompoundLabel';

/**
 * 홈 바로가기 타일 라벨 규칙
 *
 * 1. 한 줄 (`HomeShortcutsStrip` numberOfLines=1).
 * 2. 리프(일정·섹터·공시·설정) → 이름만.
 * 3. 그룹 기본(보드 all) → 상위만 (`게시판`).
 * 4. 그 외 그룹 → `상위·하위` (중점, 공백 없음).
 * 5. 하위는 탭 정식명이 아니라 홈 전용 짧은 표기(`homeTile*`).
 * 6. 결합 길이가 예산을 넘으면 하위만 (아이콘이 상위 역할).
 *    - 라틴 문자 포함: 12 / 그 외(한글·가나 등): 8
 */

const QUOTE_SEGMENT_FORMAL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  etf: 'quotesSegmentEtf',
  coin: 'quotesSegmentCoin',
};

/** 홈 타일용 시세 하위 (탭의 정식명과 동일해도 짧은 표기 유지) */
const QUOTE_SEGMENT_HOME: Record<QuoteSegmentKey, MessageId> = {
  watch: 'homeTileQuotesWatch',
  etf: 'homeTileQuotesEtf',
  coin: 'homeTileQuotesCoin',
};

const NEWS_SEGMENT_FORMAL: Record<NewsSegmentKey, MessageId> = {
  all: 'feedSegmentAll',
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
  it: 'feedSegmentIt',
  video: 'feedSegmentVideo',
};

const NEWS_SEGMENT_HOME: Record<NewsSegmentKey, MessageId> = {
  all: 'homeTileNewsAll',
  global: 'homeTileNewsGlobal',
  korea: 'homeTileNewsKorea',
  crypto: 'homeTileNewsCrypto',
  it: 'homeTileNewsIt',
  video: 'homeTileNewsVideo',
};

const BOARD_CHILD_HOME: Record<
  'save_user_news' | 'naver_likeusstock_free' | 'naver_yamizal_free',
  MessageId
> = {
  save_user_news: 'homeTileBoardSave',
  naver_likeusstock_free: 'homeTileBoardNaver',
  naver_yamizal_free: 'homeTileBoardYamizal',
};

const BOARD_CHILD_FORMAL: Record<
  'save_user_news' | 'naver_likeusstock_free' | 'naver_yamizal_free',
  MessageId
> = {
  save_user_news: 'communitySourceSaveUserNews',
  naver_likeusstock_free: 'communitySourceNaverLikeusstock',
  naver_yamizal_free: 'communitySourceNaverYamizal',
};

const SIMPLE_TITLE: Record<'calendar' | 'etf' | 'disclosures' | 'settings', MessageId> = {
  calendar: 'ipadHomeCalendarTitle',
  etf: 'moreHubEtfShort',
  disclosures: 'tabDisclosures',
  settings: 'screenSettings',
};

const GROUP_TITLE: Record<'board' | 'quotes' | 'news', MessageId> = {
  board: 'screenBoard',
  quotes: 'tabQuotes',
  news: 'tabNews',
};

export type HomeShortcutDisplay = {
  icon: ComponentProps<typeof FontAwesome>['name'];
  /** 타일·한 줄 라벨 */
  label: string;
  /** 설정 목록용 상위 라벨 */
  groupLabel?: string;
  /** 설정 목록용 하위 라벨(탭 정식명) */
  detailLabel?: string;
};

type Translate = (id: MessageId, vars?: Record<string, string | number>) => string;

export function homeShortcutDisplay(
  shortcut: HomeShortcut | HomeShortcutOption,
  t: Translate,
): HomeShortcutDisplay {
  if (shortcut.type === 'board') {
    const group = t(GROUP_TITLE.board);
    if (shortcut.source === COMMUNITY_SOURCE_ALL) {
      return {
        icon: HOME_SHORTCUT_TYPE_ICON.board,
        label: group,
        groupLabel: group,
        detailLabel: t('communitySourceAll'),
      };
    }
    const childKey = BOARD_CHILD_HOME[shortcut.source];
    const formalKey = BOARD_CHILD_FORMAL[shortcut.source];
    const detailShort = t(childKey);
    return {
      icon: HOME_SHORTCUT_TYPE_ICON.board,
      label: homeShortcutCompoundLabel(group, detailShort),
      groupLabel: group,
      detailLabel: t(formalKey),
    };
  }

  if (shortcut.type === 'quotes') {
    const group = t(GROUP_TITLE.quotes);
    return {
      icon: HOME_SHORTCUT_TYPE_ICON.quotes,
      label: homeShortcutCompoundLabel(group, t(QUOTE_SEGMENT_HOME[shortcut.segment])),
      groupLabel: group,
      detailLabel: t(QUOTE_SEGMENT_FORMAL[shortcut.segment]),
    };
  }

  if (shortcut.type === 'news') {
    const group = t(GROUP_TITLE.news);
    return {
      icon: HOME_SHORTCUT_TYPE_ICON.news,
      label: homeShortcutCompoundLabel(group, t(NEWS_SEGMENT_HOME[shortcut.segment])),
      groupLabel: group,
      detailLabel: t(NEWS_SEGMENT_FORMAL[shortcut.segment]),
    };
  }

  const title = t(SIMPLE_TITLE[shortcut.type]);
  return {
    icon: HOME_SHORTCUT_TYPE_ICON[shortcut.type],
    label: title,
    groupLabel: title,
  };
}

/** 설정 옵션 그룹 헤더 */
export function homeShortcutOptionGroupId(
  option: HomeShortcutOption,
): 'board' | 'quotes' | 'news' | 'other' {
  if (option.type === 'board' || option.type === 'quotes' || option.type === 'news') {
    return option.type;
  }
  return 'other';
}
