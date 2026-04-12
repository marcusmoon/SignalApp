/**
 * YouTube Data API v3 — **this file is the only place** in this integration that reads `env.youtubeKey`
 * and appends it to request URLs. Use `youtubeDataApiUrl` for all `fetch` calls in this package.
 */
import { env } from '@/services/env';

export function isYoutubeDataApiConfigured(): boolean {
  return env.youtubeKey.length > 0;
}

export function youtubeDataApiUrl(path: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ ...params, key: env.youtubeKey });
  return `https://www.googleapis.com/youtube/v3/${path}?${q.toString()}`;
}
