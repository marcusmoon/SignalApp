import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { MessageId } from '@/locales/messages';
import { orderAppLaunchUrlsForPlatform, yahooFinanceAppLaunchUrls } from '@/utils/openExternalLink';
import { tossFinanceAppLaunchUrls } from '@/utils/tossFinance';

export type ReferenceLinkGroupId = 'global' | 'exchanges';

export type ReferenceLinkItem = {
  id: string;
  labelKey: MessageId;
  /** Font Awesome 글리프 (`iconMark` 없을 때만) */
  icon?: ComponentProps<typeof FontAwesome>['name'];
  /** 원 안에 표시할 짧은 브랜드 텍스트(예: Upbit, Toss) — 있으면 `icon` 대신 사용 */
  iconMark?: string;
  webUrl: string;
  /** 퀵 링크 탭 시 인앱 브라우저로만 열기 (앱 URL 없을 때) */
  openInAppBrowser?: boolean;
  /** iOS·iPad 앱 우선 — `openConfiguredExternalLink`가 공통 처리 */
  appLaunchUrls?: string[];
};

export type ReferenceLinkGroup = {
  id: ReferenceLinkGroupId;
  items: ReferenceLinkItem[];
};

export const REFERENCE_LINK_GROUPS: ReferenceLinkGroup[] = [
  {
    id: 'global',
    items: [
      {
        id: 'yahoo',
        labelKey: 'moreRefTitleYahoo',
        icon: 'yahoo',
        webUrl: 'https://finance.yahoo.com',
        appLaunchUrls: yahooFinanceAppLaunchUrls('https://finance.yahoo.com'),
      },
      {
        id: 'google-finance',
        labelKey: 'moreRefTitleGoogleFinance',
        icon: 'google',
        webUrl: 'https://www.google.com/finance',
      },
      {
        id: 'bloomberg',
        labelKey: 'moreRefTitleBloomberg',
        icon: 'newspaper-o',
        webUrl: 'https://www.bloomberg.com',
      },
      {
        id: 'investing',
        labelKey: 'moreRefTitleInvesting',
        icon: 'globe',
        webUrl: 'https://www.investing.com',
      },
      {
        id: 'likeusstock-cafe',
        labelKey: 'moreRefTitleLikeUsStock',
        iconMark: 'Cafe',
        webUrl: 'https://m.cafe.naver.com/likeusstock',
        openInAppBrowser: true,
      },
    ],
  },
  {
    id: 'exchanges',
    items: [
      {
        id: 'upbit',
        labelKey: 'moreRefTitleUpbit',
        iconMark: 'Upbit',
        webUrl: 'https://upbit.com',
        appLaunchUrls: orderAppLaunchUrlsForPlatform(
          ['upbit://open', 'upbit://', 'https://upbit.com'],
          'https://upbit.com',
        ),
      },
      {
        id: 'toss',
        labelKey: 'moreRefTitleTossSecurities',
        iconMark: 'Toss',
        webUrl: 'https://www.tossinvest.com',
        appLaunchUrls: tossFinanceAppLaunchUrls('https://www.tossinvest.com'),
      },
      {
        id: 'binance',
        labelKey: 'moreRefTitleBinance',
        icon: 'btc',
        webUrl: 'https://www.binance.com',
        appLaunchUrls: orderAppLaunchUrlsForPlatform(
          ['bnc://app.binance.com/', 'bnc://app.binance.com', 'binance://', 'https://www.binance.com'],
          'https://www.binance.com',
        ),
      },
    ],
  },
];

/** 퀵 링크: 카테고리 없이 한 그리드 — 위 그룹 순서대로 이어붙임 */
export const REFERENCE_LINK_ITEMS: ReferenceLinkItem[] = REFERENCE_LINK_GROUPS.flatMap((g) => g.items);
