/**
 * CoinGecko REST is server-side only.
 * App code should read coin markets through `integrations/signal-api/market`.
 */
export function buildCoinsMarketsUrl(limit: number): string {
  void limit;
  throw new Error('SIGNAL_API_ONLY');
}

export async function fetchCoinsMarketsJson(limit: number): Promise<unknown> {
  void limit;
  throw new Error('SIGNAL_API_ONLY');
}
