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
};

export type SignalApiCalendarDateSummary = {
  date: string;
  total: number;
  counts: Partial<Record<SignalApiCalendarEvent['type'], number>>;
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
  channelHandle?: string | null;
  description: string;
  publishedAt: string | null;
  duration: string;
  viewCount: number;
  thumbnailUrl?: string | null;
  sortBucket?: 'latest' | 'popular' | string;
  sortBuckets?: string[];
  fetchedAt: string;
};

export type SignalApiYoutubeChannel = {
  handle: string;
  title: string;
  count: number;
  latestAt: string | null;
  order: number;
  configured: boolean;
};

/** `/v1/youtube` — 뉴스(`/v1/news`)와 동일한 `meta` 형태 (`limit` / `offset` / `nextOffset`) */
export type SignalYoutubeListMeta = SignalNewsListMeta;

export type SignalYoutubePage = {
  items: SignalApiYoutubeVideo[];
  meta: SignalYoutubeListMeta;
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
  displaySymbol?: string | null;
  krxSymbol?: string | null;
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
  sourceLabel?: string | null;
  official?: boolean | null;
  notice?: string | null;
  afterHoursAvailable?: boolean | null;
  regularSession?: {
    yahooSymbol?: string | null;
    currentPrice: number | null;
    change: number | null;
    changePercent: number | null;
    high: number | null;
    low: number | null;
    open: number | null;
    previousClose: number | null;
    quoteTime: string | null;
  } | null;
};

export type SignalApiWatchSignal = {
  symbol: string;
  score: number;
  level: 'quiet' | 'watch' | 'hot' | string;
  title: string;
  summary: string;
  reasonCodes: string[];
  quote: SignalApiMarketQuote | null;
  counts: {
    news: number;
    youtube: number;
    insights: number;
  };
  nextEvent: SignalApiCalendarEvent | null;
  sourceRefs: SignalApiInsightSourceRef[];
};

export type SignalApiQuantSignalFactors = {
  trend: number;
  momentum: number;
  meanReversion: number;
  volume: number;
};

export type SignalApiQuantIndicators = {
  lastClose: number | null;
  sma20: number | null;
  sma60: number | null;
  vsSma20Pct: number | null;
  vsSma60Pct: number | null;
  return20d: number | null;
  return60d: number | null;
  rsi14: number | null;
  volatility: number | null;
  vsHigh52wPct: number | null;
  volumeRatio: number | null;
};

export type SignalApiQuantSignal = {
  symbol: string;
  displaySymbol?: string | null;
  name: string | null;
  rank?: number | null;
  score: number;
  level: 'strong' | 'watch' | 'neutral' | 'weak' | string;
  action: 'buy' | 'accumulate' | 'hold' | 'reduce' | 'avoid' | string;
  headline?: string | null;
  interpretation?: string | null;
  risk: 'low' | 'medium' | 'high' | 'unknown' | string;
  confidence: number;
  factors: SignalApiQuantSignalFactors;
  indicators: SignalApiQuantIndicators;
  reasonCodes: string[];
  barCount: number;
  lastBarDate: string | null;
  liveQuote: SignalApiMarketQuote | null;
  updatedAt: string | null;
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

export type SignalApiInsightSourceRef = {
  type: 'news' | 'youtube' | string;
  id: string;
  title: string;
  url?: string;
  sourceName?: string;
  publishedAt?: string | null;
};

export type SignalApiInsight = {
  id: string;
  kind: 'market_brief' | 'asset_signal' | string;
  level: 'brief' | 'watch' | 'alert' | string;
  score: number;
  title: string;
  summary: string;
  whyNow?: string;
  actionLabel?: string;
  signalDrivers?: string[];
  sourceStats?: {
    news?: number;
    youtube?: number;
    quote?: number;
    earnings?: number;
  } | null;
  nextSteps?: string[];
  priceMovePercent?: number | null;
  earningsDate?: string | null;
  symbols: string[];
  topics: string[];
  reasoning: string[];
  sourceRefs: SignalApiInsightSourceRef[];
  pushCandidate: boolean;
  pushPriority?: 'high' | 'normal' | 'none' | string;
  pushTitle?: string;
  pushBody?: string;
  generatedAt: string | null;
  expiresAt: string | null;
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
  summaryStatus: 'completed' | 'missing' | 'failed' | string;
  summaryProvider: 'openai' | 'claude' | string | null;
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
