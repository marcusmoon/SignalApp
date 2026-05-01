export type SignalApiNewsHashtag = {
  label: string;
  order: number;
  source: 'auto' | 'manual' | string;
};

export type SignalApiNewsItem = {
  id: string;
  category: string;
  title: string;
  summary: string;
  displayLocale: string;
  translationStatus: 'completed' | 'manual' | 'missing' | 'failed' | string;
  originalTitle: string;
  originalSummary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string | null;
  symbols: string[];
  /** 서버 관리: 노출 순서(order) 기준 정렬된 태그 */
  hashtags?: SignalApiNewsHashtag[];
  provider: string;
  publishedAt: string | null;
  fetchedAt: string;
};

export type SignalNewsListMeta = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type SignalApiNewsSource = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  order: number;
};

export type SignalApiCalendarEvent = {
  id: string;
  provider: string;
  providerItemId: string;
  type: 'earnings' | 'macro' | 'fed' | 'fomc';
  title: string;
  country: string | null;
  symbol: string | null;
  eventAt: string | null;
  date: string | null;
  timeLabel: string;
  impact: 'low' | 'medium' | 'high' | null;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
  unit: string | null;
  fiscalYear: number | null;
  fiscalQuarter: number | null;
  earningsHour: string | null;
  fetchedAt: string;
  rawPayload?: unknown;
};

export type SignalApiYoutubeVideo = {
  id: string;
  provider: string;
  providerItemId: string;
  videoId: string;
  topic: string;
  title: string;
  channel: string;
  channelId: string;
  description: string;
  publishedAt: string | null;
  duration: string;
  viewCount: number;
  thumbnailUrl?: string | null;
  fetchedAt: string;
};

export type SignalApiMarketList = {
  key: string;
  displayName: string;
  description: string;
  symbols: string[];
  count: number;
  updatedAt: string | null;
};

export type SignalApiMarketQuote = {
  id: string;
  provider: string;
  providerItemId: string;
  segment: string;
  symbol: string;
  name: string | null;
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  marketCapitalization: number | null;
  quoteTime: string | null;
  fetchedAt: string;
};

export type SignalApiCoinMarket = {
  id: string;
  provider: string;
  providerItemId: string;
  symbol: string;
  name: string;
  currentPrice: number | null;
  marketCap: number | null;
  change24h: number | null;
  changePercent24h: number | null;
  fetchedAt: string;
};

export type SignalApiConcall = {
  id: string;
  provider: string;
  providerItemId: string;
  symbol: string;
  title: string;
  fiscalYear: number | null;
  fiscalQuarter: number | null;
  earningsDate: string | null;
  earningsHour: string | null;
  transcriptSnippet: string;
  transcript?: string;
  transcriptHash: string;
  transcriptCharCount: number;
  summaryStatus: 'completed' | 'missing' | 'failed' | string;
  summaryProvider: 'openai' | 'claude' | string | null;
  summaryModel: string | null;
  summaryBullets: string[];
  guidance: string;
  risk: string;
  fetchedAt: string;
};

/** `/v1/stock-profile` — shape matches server `data` payload */
export type SignalApiStockProfile = {
  symbol?: string;
  name?: string;
  marketCapitalization?: number;
};

/** `/v1/stock-candles` — shape matches server `data` payload */
export type SignalApiStockCandles = {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: 'ok' | 'no_data';
  t: number[];
  v: number[];
};
