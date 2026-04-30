/**
 * Finnhub REST is now server-side only.
 * App code must call `integrations/signal-api/*` instead of using this client.
 */
export async function fh<T>(path: string, params: Record<string, string>): Promise<T> {
  void path;
  void params;
  throw new Error('SIGNAL_API_ONLY');
}
