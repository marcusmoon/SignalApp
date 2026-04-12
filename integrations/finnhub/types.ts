/** Finnhub REST API DTOs — keep in sync with https://finnhub.io/docs/api */

export type FinnhubNewsRaw = {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
};

export type FinnhubEarningsRow = {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
};

export type FinnhubEconomicRow = {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: string;
  prev: number | null;
  time: string;
  unit: string;
};

/** Finnhub market news: `general` · `forex` · `crypto` · `merger` */
export type FinnhubMarketNewsCategory = 'general' | 'forex' | 'crypto' | 'merger';

/** Finnhub `/quote` — missing ticker often returns `{}` without `c` */
export type FinnhubQuote = {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
};

export type FinnhubStockCandles = {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: 'ok' | 'no_data';
  t: number[];
  v: number[];
};

/** Finnhub `marketCapitalization` is in millions USD */
export type FinnhubProfile2 = {
  symbol?: string;
  name?: string;
  marketCapitalization?: number;
};
