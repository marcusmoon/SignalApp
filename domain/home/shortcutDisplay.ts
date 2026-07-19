import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { COMMUNITY_SOURCE_ALL } from '@/constants/communitySources';
import {
  HOME_SHORTCUT_TYPE_ICON,
  type HomeShortcut,
  type HomeShortcutOption,
} from '@/constants/homeShortcuts';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import type { QuoteSegmentKey } from '@/domain/quotes/constants';
import type { MessageId } from '@/locales/messages';

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
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
  /** 설정 목록용 하위 라벨 */
  detailLabel?: string;
};

type Translate = (id: MessageId, vars?: Record<string, string | number>) => string;

export function homeShortcutDisplay(
  shortcut: HomeShortcut | HomeShortcutOption,
  t: Translate,
): HomeShortcutDisplay {
  if (shortcut.type === 'communityPost') {
    const title =
      'title' in shortcut && shortcut.title?.trim()
        ? shortcut.title.trim()
        : t('homeShortcutBoardPost');
    return {
      icon: 'comment',
      label: title,
      groupLabel: t('screenBoard'),
      detailLabel: title,
    };
  }

  if (shortcut.type === 'board') {
    const detail =
      shortcut.source === COMMUNITY_SOURCE_ALL
        ? t('communitySourceAll')
        : t(communitySourceLabelId(shortcut.source));
    return {
      icon: HOME_SHORTCUT_TYPE_ICON.board,
      label: `${t(GROUP_TITLE.board)} · ${detail}`,
      groupLabel: t(GROUP_TITLE.board),
      detailLabel: detail,
    };
  }

  if (shortcut.type === 'quotes') {
    const detail = t(QUOTE_SEGMENT_LABEL[shortcut.segment]);
    return {
      icon: HOME_SHORTCUT_TYPE_ICON.quotes,
      label: `${t(GROUP_TITLE.quotes)} · ${detail}`,
      groupLabel: t(GROUP_TITLE.quotes),
      detailLabel: detail,
    };
  }

  if (shortcut.type === 'news') {
    const detail = t(NEWS_SEGMENT_LABEL[shortcut.segment]);
    return {
      icon: HOME_SHORTCUT_TYPE_ICON.news,
      label: `${t(GROUP_TITLE.news)} · ${detail}`,
      groupLabel: t(GROUP_TITLE.news),
      detailLabel: detail,
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
