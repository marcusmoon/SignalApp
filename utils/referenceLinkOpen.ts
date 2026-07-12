import { Platform } from 'react-native';

import type { ReferenceLinkItem } from '@/constants/referenceAppLinks';
import { openExternalLink } from '@/utils/openExternalLink';
import {
  naverFinanceAndroidIntentUrl,
  naverFinanceInAppBrowserScheme,
} from '@/utils/naverFinance';
import {
  binanceAndroidIntentUrl,
  upbitAndroidIntentUrl,
  yahooFinanceAndroidIntentUrl,
} from '@/utils/openExternalLink';
import { tossInvestAndroidIntentUrl } from '@/utils/tossFinance';

/** 더보기 숏링크 — https는 폴백에서 처리하고, 여기서는 앱 스킴만 시도 */
export function buildReferenceAppLaunchUrls(
  item: Pick<ReferenceLinkItem, 'id' | 'webUrl'>,
): string[] | undefined {
  const { id, webUrl } = item;

  if (id === 'yahoo') {
    if (Platform.OS === 'android') {
      return [yahooFinanceAndroidIntentUrl(webUrl), 'yfinance://', 'yahoo://'];
    }
    if (Platform.OS === 'ios') {
      return ['yfinance://', 'yahoo://'];
    }
    return undefined;
  }

  if (id === 'toss') {
    if (Platform.OS === 'android') {
      return [tossInvestAndroidIntentUrl(webUrl), 'supertoss://invest', 'supertoss://'];
    }
    if (Platform.OS === 'ios') {
      return ['supertoss://invest', 'supertoss://'];
    }
    return undefined;
  }

  if (id === 'upbit') {
    if (Platform.OS === 'android') {
      return [upbitAndroidIntentUrl(webUrl), 'upbit://open', 'upbit://'];
    }
    if (Platform.OS === 'ios') {
      return ['upbit://open', 'upbit://'];
    }
    return undefined;
  }

  if (id === 'binance') {
    if (Platform.OS === 'android') {
      return [binanceAndroidIntentUrl(webUrl), 'bnc://app.binance.com/', 'binance://'];
    }
    if (Platform.OS === 'ios') {
      return ['bnc://app.binance.com/', 'binance://'];
    }
    return undefined;
  }

  if (id === 'likeusstock-cafe') {
    const inApp = naverFinanceInAppBrowserScheme(webUrl);
    if (Platform.OS === 'android') {
      return [naverFinanceAndroidIntentUrl(webUrl), inApp];
    }
    if (Platform.OS === 'ios') {
      return [inApp];
    }
    return undefined;
  }

  return undefined;
}

/** 더보기 숏링크 — 앱 우선 시도 후 항상 인앱 브라우저로 폴백 */
export async function openReferenceLink(item: ReferenceLinkItem): Promise<void> {
  if (item.openInAppBrowser && !item.appLaunchUrls?.length) {
    await openExternalLink(item.webUrl, undefined, { preferInAppBrowser: true });
    return;
  }

  const appLaunchUrls = item.appLaunchUrls ?? buildReferenceAppLaunchUrls(item);
  await openExternalLink(item.webUrl, appLaunchUrls, {
    preferInAppBrowserAfterAppAttempts: true,
  });
}
