/** Shared public API read cache — keep clear() reachable without importing db.mjs. */

export const PUBLIC_READ_CACHE_TTL_MS = 5000;
export const PUBLIC_READ_CACHE_MAX_ENTRIES = 300;

export const publicReadCache = new Map();
const publicReadInFlight = new Map();

export function clearPublicReadCache() {
  publicReadCache.clear();
  publicReadInFlight.clear();
}

/**
 * Delete cache entries whose keys start with `${namespace}:` for any listed namespace.
 * Also drops matching in-flight singleflight promises so writers do not re-cache stale reads.
 */
export function clearPublicReadCacheByNamespaces(namespaces) {
  const list = (Array.isArray(namespaces) ? namespaces : [])
    .map((ns) => String(ns || '').trim())
    .filter(Boolean);
  if (list.length === 0) return;
  const prefixes = list.map((ns) => `${ns}:`);
  for (const key of [...publicReadCache.keys()]) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      publicReadCache.delete(key);
    }
  }
  for (const key of [...publicReadInFlight.keys()]) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      publicReadInFlight.delete(key);
    }
  }
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

  const inflight = publicReadInFlight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const value = await fn();
      if (ttlMs > 0) {
        const storeAt = Date.now();
        if (publicReadCache.size >= PUBLIC_READ_CACHE_MAX_ENTRIES) {
          for (const [cacheKey, entry] of publicReadCache) {
            if (entry.expiresAt <= storeAt || publicReadCache.size >= PUBLIC_READ_CACHE_MAX_ENTRIES) {
              publicReadCache.delete(cacheKey);
            }
            if (publicReadCache.size < PUBLIC_READ_CACHE_MAX_ENTRIES) break;
          }
        }
        publicReadCache.set(key, { value, expiresAt: storeAt + ttlMs });
      }
      return value;
    } finally {
      publicReadInFlight.delete(key);
    }
  })();

  publicReadInFlight.set(key, promise);
  return promise;
}
