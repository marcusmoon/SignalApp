import {
  googleFaviconIconUrl,
  NAVER_CAFE_ICON_URL,
} from '@/constants/sourceIconUrls';
import { domainFromUrl } from '@/services/sourceIcon';

/** 링크 id → 파비콘 조회용 루트 도메인 */
const FAVICON_DOMAIN_BY_LINK_ID: Readonly<Record<string, string>> = {
  naver: 'naver.com',
  toss: 'tossinvest.com',
  yahoo: 'finance.yahoo.com',
  'yahoo-earnings': 'finance.yahoo.com',
  'google-finance': 'google.com',
  sec: 'sec.gov',
  tradingview: 'tradingview.com',
  'naver-news': 'naver.com',
  'naver-dart': 'naver.com',
  dart: 'dart.fss.or.kr',
  upbit: 'upbit.com',
  binance: 'binance.com',
  bloomberg: 'bloomberg.com',
  investing: 'investing.com',
};

/** 숏컷·종목 바로가기 파비콘 URL (Google favicon API + 고정 예외) */
export function externalLinkFaviconUrl(
  linkId: string,
  webUrl: string,
  size = 32,
): string {
  if (linkId === 'likeusstock-cafe') {
    return NAVER_CAFE_ICON_URL;
  }

  const mapped = FAVICON_DOMAIN_BY_LINK_ID[linkId];
  if (mapped) {
    return googleFaviconIconUrl(mapped, size);
  }

  const host = domainFromUrl(webUrl);
  if (!host) {
    return googleFaviconIconUrl('example.com', size);
  }
  if (host.endsWith('naver.com')) {
    return googleFaviconIconUrl('naver.com', size);
  }
  return googleFaviconIconUrl(host, size);
}
