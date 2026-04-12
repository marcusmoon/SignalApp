import { COMPANY_NEWS_DISPLAY_MAX, COMPANY_NEWS_LOOKBACK_DAYS } from '@/constants/companyNewsDisplay';
import { fetchCompanyNews, type FinnhubNewsRaw } from '@/integrations/finnhub';
import { addDays } from '@/utils/date';

/**
 * 종목별 회사 뉴스를 한 곳에서 가져와 최신순·노출 상한만 적용합니다.
 * (브리핑, 종목 상세 등)
 */
export async function fetchCompanyNewsForDisplay(symbol: string): Promise<FinnhubNewsRaw[]> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return [];
  const to = new Date();
  const from = addDays(to, -COMPANY_NEWS_LOOKBACK_DAYS);
  const raw = await fetchCompanyNews(sym, from, to);
  return [...raw].sort((a, b) => b.datetime - a.datetime).slice(0, COMPANY_NEWS_DISPLAY_MAX);
}
