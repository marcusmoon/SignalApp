import { COMPANY_NEWS_DISPLAY_MAX, COMPANY_NEWS_LOOKBACK_DAYS } from '@/constants/companyNewsDisplay';
import { fetchSignalNews } from '@/integrations/signal-api/news';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import { addDays, toYmd } from '@/utils/date';

/**
 * 종목별 회사 뉴스를 한 곳에서 가져와 최신순·노출 상한만 적용합니다.
 * (브리핑, 종목 상세 등 — Signal 서버 `/v1/news`만 사용)
 */
export async function fetchCompanyNewsForDisplay(
  symbol: string,
  locale = 'ko',
): Promise<SignalApiNewsItem[]> {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !hasSignalApi()) return [];
  const to = new Date();
  const from = addDays(to, -COMPANY_NEWS_LOOKBACK_DAYS);
  try {
    const { items } = await fetchSignalNews({
      symbol: sym,
      limit: Math.min(COMPANY_NEWS_DISPLAY_MAX * 6, 200),
      offset: 0,
      locale,
      from: toYmd(from),
      to: toYmd(to),
    });
    return [...items]
      .sort((a, b) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, COMPANY_NEWS_DISPLAY_MAX);
  } catch {
    return [];
  }
}
