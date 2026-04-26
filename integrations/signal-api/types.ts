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
  provider: string;
  publishedAt: string | null;
  fetchedAt: string;
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
