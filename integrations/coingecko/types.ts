/** CoinGecko `/coins/markets` 행 — https://docs.coingecko.com/reference/coins-markets */
export type CoinGeckoMarketRow = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
};
