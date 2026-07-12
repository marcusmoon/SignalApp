import { Platform } from 'react-native';

import type { ReferenceLinkItem } from '@/constants/referenceAppLinks';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { naverFinanceStockAppLaunchUrls } from '@/utils/naverFinance';
import {
  binanceAndroidIntentUrl,
  upbitAndroidIntentUrl,
} from '@/utils/openExternalLink';
import { tossFinanceHomeAppLaunchUrls } from '@/utils/tossFinance';
import { yahooFinanceHomeAppLaunchUrls } from '@/utils/yahooFinance';

const UPBIT_SCHEMES = ['upbit://open', 'upbit://'] as const;
const BINANCE_SCHEMES = ['bnc://app.binance.com/', 'binance://'] as const;

/** 더보기 숏링크 — 종목 상세와 같은 앱 우선 launch 목록 */
export function buildReferenceAppLaunchUrls(
  item: Pick<ReferenceLinkItem, 'id' | 'webUrl'>,
): string[] | undefined {
  const { id, webUrl } = item;

  if (id === 'yahoo') {
    return yahooFinanceHomeAppLaunchUrls(webUrl);
  }
  if (id === 'toss') {
    return tossFinanceHomeAppLaunchUrls(webUrl);
  }
  if (id === 'likeusstock-cafe') {
    return naverFinanceStockAppLaunchUrls(webUrl);
  }
  if (id === 'upbit') {
    if (Platform.OS === 'android') {
      return [upbitAndroidIntentUrl(webUrl), ...UPBIT_SCHEMES];
    }
    if (Platform.OS === 'ios') {
      return [...UPBIT_SCHEMES];
    }
    return [...UPBIT_SCHEMES];
  }
  if (id === 'binance') {
    if (Platform.OS === 'android') {
      return [binanceAndroidIntentUrl(webUrl), ...BINANCE_SCHEMES];
    }
    if (Platform.OS === 'ios') {
      return [...BINANCE_SCHEMES];
    }
    return [...BINANCE_SCHEMES];
  }

  return undefined;
}

/** 더보기 숏링크 — 종목 상세와 동일한 앱 우선·유니버설 링크 폴백 */
export async function openReferenceLink(item: ReferenceLinkItem): Promise<void> {
  if (item.openInAppBrowser) {
    await openConfiguredExternalLink({
      webUrl: item.webUrl,
      openInAppBrowser: true,
    });
    return;
  }

  await openConfiguredExternalLink({
    webUrl: item.webUrl,
    appLaunchUrls: buildReferenceAppLaunchUrls(item),
  });
}
