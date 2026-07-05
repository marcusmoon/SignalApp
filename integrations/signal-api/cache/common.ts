type Entry<T> = { value: T; expiresAt: number };

/** 리스트·피드 API 기본 TTL (뉴스, 커뮤니티, 공시, 다이제스트, 브리핑). */
export const SIGNAL_FEED_CACHE_TTL_MS = 2 * 60 * 1000;

/** 시세·코인 — 실시간 채널 도입 전까지 조금 더 길게 유지. */
export const SIGNAL_MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

/** 정적 카탈로그 (마켓 리스트, 뉴스 소스 등). */
export const SIGNAL_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

export function peekCache<T>(map: Map<string, Entry<T>>, key: string): T | null {
  const e = map.get(key);
  if (e && Date.now() < e.expiresAt) return e.value;
  return null;
}

export function storeCache<T>(map: Map<string, Entry<T>>, key: string, value: T, ttlMs: number): void {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

