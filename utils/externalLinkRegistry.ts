import { Platform } from 'react-native';

import { nativeAppLaunchUrls } from '@/utils/externalLinkLaunch';
import { canAttemptNativeAppLaunch } from '@/utils/externalLinkPlatform';
import { naverFinanceStockAppLaunchUrls } from '@/utils/naverFinance';
import {
  binanceAndroidIntentUrl,
  upbitAndroidIntentUrl,
} from '@/utils/openExternalLink';
import { tossFinanceHomeAppLaunchUrls } from '@/utils/tossFinance';
import { yahooFinanceAppLaunchUrls } from '@/utils/yahooFinance';

export type AppLaunchBuildInput = {
  webUrl: string;
  /** `referenceAppLinks`·`symbolExternalLinks` id — 없으면 host 자동 매칭 */
  linkId?: string;
};

type LaunchBuilder = (webUrl: string) => string[] | undefined;

const UPBIT_SCHEMES = ['upbit://open', 'upbit://'] as const;
const BINANCE_SCHEMES = ['bnc://app.binance.com/', 'binance://'] as const;

function upbitLaunchUrls(webUrl: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;
  if (Platform.OS === 'android') {
    return [upbitAndroidIntentUrl(webUrl), ...UPBIT_SCHEMES];
  }
  return nativeAppLaunchUrls(webUrl, { ios: UPBIT_SCHEMES });
}

function binanceLaunchUrls(webUrl: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;
  if (Platform.OS === 'android') {
    return [binanceAndroidIntentUrl(webUrl), ...BINANCE_SCHEMES];
  }
  return nativeAppLaunchUrls(webUrl, { ios: BINANCE_SCHEMES });
}

/** 더보기·종목 링크 id → 앱 launch URL 빌더 (신규 링크는 여기만 등록) */
const LINK_ID_BUILDERS: Record<string, LaunchBuilder> = {
  yahoo: yahooFinanceAppLaunchUrls,
  'yahoo-earnings': yahooFinanceAppLaunchUrls,
  naver: naverFinanceStockAppLaunchUrls,
  toss: tossFinanceHomeAppLaunchUrls,
  'likeusstock-cafe': naverFinanceStockAppLaunchUrls,
  upbit: upbitLaunchUrls,
  binance: binanceLaunchUrls,
};

function normalizeHost(webUrl: string): string | null {
  try {
    return new URL(webUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostLaunchBuilder(webUrl: string): LaunchBuilder | null {
  const host = normalizeHost(webUrl);
  if (!host) return null;
  if (host === 'finance.yahoo.com') return yahooFinanceAppLaunchUrls;
  if (host === 'm.stock.naver.com' || host === 'm.cafe.naver.com') {
    return naverFinanceStockAppLaunchUrls;
  }
  if (host === 'tossinvest.com') return tossFinanceHomeAppLaunchUrls;
  if (host === 'upbit.com') return upbitLaunchUrls;
  if (host === 'binance.com') return binanceLaunchUrls;
  return null;
}

/**
 * 앱 우선 launch URL 목록 — iPhone·iPad 네이티브 / iOS Safari 웹 / Android 네이티브.
 * 열기 정책(스킴 순서·폴백)은 `openExternalLink`가 플랫폼별로 처리한다.
 */
export function buildAppLaunchUrls(input: AppLaunchBuildInput): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;

  const linkId = String(input.linkId || '').trim();
  if (linkId && LINK_ID_BUILDERS[linkId]) {
    return LINK_ID_BUILDERS[linkId](input.webUrl);
  }

  const byHost = hostLaunchBuilder(input.webUrl);
  if (byHost) return byHost(input.webUrl);

  return undefined;
}

/** 등록된 앱 연동 링크 id (더보기·종목 공통) */
export function registeredAppLinkIds(): string[] {
  return Object.keys(LINK_ID_BUILDERS);
}
