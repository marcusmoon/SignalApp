import { env, hasFinnhub } from '@/services/env';

/**
 * Finnhub REST — **only this module** in the integration reads `env.finnhubToken` for outbound calls.
 * Domain code in `index.ts` / `calendarCache.ts` etc. must use `fh()` (or wrappers), never the token directly.
 *
 * **Standard for new providers:** `integrations/<name>/client.ts` holds auth + base transport;
 * `types.ts` + `index.ts` (and optional `*Cache.ts`) build on top.
 */
export async function fh<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!hasFinnhub()) throw new Error('FINNHUB_TOKEN_MISSING');
  const q = new URLSearchParams({ ...params, token: env.finnhubToken });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${q.toString()}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Finnhub ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
