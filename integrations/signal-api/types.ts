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

export type SignalApiNewsDigestSourceRef = {
  type: 'news' | string;
  id: string;
  newsId?: string;
  title: string;
  url: string | null;
  sourceName: string;
  publishedAt: string | null;
};

export type SignalApiNewsDigestItem = {
  id: string;
  category: string;
  title: string;
  summary: string;
  symbols: string[];
  sources: string[];
  topics: string[];
  count: number;
  generatedDate: string | null;
  generatedAt: string | null;
  primaryNewsId: string | null;
  sourceRefs: SignalApiNewsDigestSourceRef[];
  aiGenerated?: boolean | null;
};

export type SignalApiMarketBriefingSourceRef = {
  kind?: string;
  title: string;
  url: string | null;
  sourceName?: string | null;
  publishedAt?: string | null;
  checkedAt?: string | null;
  recency?: 'latest' | 'older' | string;
};

export type SignalApiMarketBriefingCompany = {
  symbol: string;
  name?: string | null;
  price?: number | null;
  changePercent?: number | null;
  summary: string;
  news?: SignalApiMarketBriefingSourceRef[];
};

export type SignalApiMarketBriefingMacroItem = {
  title: string;
  summary: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  publishedAt?: string | null;
  checkedAt?: string | null;
  recency?: 'latest' | 'older' | string;
};

export type SignalApiMarketBriefingSector = {
  /** 섹터명. 예: "반도체", "방산", "Tech", "Energy" */
  name: string;
  /** 흐름 방향. 예: "▲", "▽", "→" */
  trend: string;
  /** 한 줄 요약. 예: "SK하이닉스 +4.3%, HBM 수요 기대감" */
  summary: string;
};

export type SignalApiMarketBriefing = {
  id: string;
  market: 'kr' | 'us' | string;
  session: 'morning' | 'lunch' | 'evening' | 'overnight' | 'close' | string;
  title: string;
  headline: string;
  summary: string;
  overview: string[];
  sectors?: SignalApiMarketBriefingSector[];
  companies: SignalApiMarketBriefingCompany[];
  macro: SignalApiMarketBriefingMacroItem[];
  sourceRefs: SignalApiMarketBriefingSourceRef[];
  publishedAt: string | null;
  briefingDate: string | null;
  pushCandidate: boolean;
  pushTitle: string;
  pushBody: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SignalApiNewsSource = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  order: number;
};

export type SignalApiDisclosure = {
  id: string;
  market: 'us' | 'kr' | string | null;
  provider: 'sec' | 'dart' | string | null;
  symbol: string | null;
  companyName: string | null;
  formType: string | null;
  title: string;
  summary: string;
  url: string | null;
  filedAt: string | null;
  periodEndDate: string | null;
  fetchedAt: string | null;
  rawPayload?: unknown;
};

export type SignalApiDisclosureDigestSourceRef = {
  type: 'disclosure';
  id: string;
  title: string;
  url: string | null;
  companyName: string;
  symbol: string | null;
  formType: string | null;
  filedAt: string | null;
};

export type SignalApiDisclosureDigestItem = {
  id: string;
  market: 'us' | 'kr' | string;
  title: string;
  summary: string;
  symbols: string[];
  companies: string[];
  forms: string[];
  count: number;
  generatedDate: string | null;
  generatedAt: string | null;
  primaryDisclosureId: string | null;
  sourceRefs: SignalApiDisclosureDigestSourceRef[];
};

export type SignalApiCalendarEvent = {
  id: string;
  provider: string;
  providerItemId: string;
  type: 'earnings' | 'macro' | 'fed' | 'fomc' | 'holiday';
  title: string;
  country: string | null;
  symbol: string | null;
  eventAt: string | null;
  date: string | null;
  timeLabel: string;
  timezone: string | null;
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
