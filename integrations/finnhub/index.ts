/**
 * Finnhub 통합 — HTTP는 `client.ts`의 `fh()`만 사용.
 * 뉴스·캘린더·시세는 파일을 나눠 유지보수하기 쉽게 했다.
 */
export type {
  FinnhubEconomicRow,
  FinnhubEarningsRow,
  FinnhubMarketNewsCategory,
  FinnhubNewsRaw,
  FinnhubProfile2,
  FinnhubQuote,
  FinnhubStockCandles,
} from '@/integrations/finnhub/types';

export {
  DEFAULT_MCAP_TOP_N,
  DEFAULT_US_WATCHLIST,
  MCAP_SCREEN_UNIVERSE,
  POPULAR_SYMBOLS_ORDERED,
} from '@/integrations/finnhub/constants';

export {
  fetchCompanyNews,
  fetchGeneralNews,
  fetchMarketNews,
  mergeNewsById,
} from '@/integrations/finnhub/news';

export {
  fetchCalendarEventsMerged,
  fetchEarningsCalendarRange,
  fetchEarningsCalendarRangeMerged,
  fetchEconomicCalendarRange,
  mapEarningsToEvents,
  mapEconomicToEvents,
} from '@/integrations/finnhub/calendar';

export {
  fetchProfile2,
  fetchQuote,
  fetchQuotesForSymbols,
  fetchStockCandles,
  fetchUsdKrwQuoteApprox,
  finnhubQuoteHasValidPrice,
  getSymbolsSortedByMarketCap,
} from '@/integrations/finnhub/quotes';
