/** Shared public API read cache — keep clear() reachable without importing db.mjs. */

export const PUBLIC_READ_CACHE_TTL_MS = 5000;
export const PUBLIC_READ_CACHE_MAX_ENTRIES = 300;

export const publicReadCache = new Map();

export function clearPublicReadCache() {
  publicReadCache.clear();
}

/** Admin writes that affect public symbolMeta / feeds. */
export function clearPublicApiReadCache() {
  clearPublicReadCache();
}

export function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

export async function cachedPublicRead(namespace, options, fn, ttlMs = PUBLIC_READ_CACHE_TTL_MS) {
  const key = `${namespace}:${stableStringify(options || {})}`;
  const now = Date.now();
  const cached = publicReadCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) publicReadCache.delete(key);
  const value = await fn();
  if (ttlMs > 0) {
    if (publicReadCache.size >= PUBLIC_READ_CACHE_MAX_ENTRIES) {
      for (const [cacheKey, entry] of publicReadCache) {
        if (entry.expiresAt <= now || publicReadCache.size >= PUBLIC_READ_CACHE_MAX_ENTRIES) {
          publicReadCache.delete(cacheKey);
        }
        if (publicReadCache.size < PUBLIC_READ_CACHE_MAX_ENTRIES) break;
      }
    }
    publicReadCache.set(key, { value, expiresAt: now + ttlMs });
  }
  return value;
}
