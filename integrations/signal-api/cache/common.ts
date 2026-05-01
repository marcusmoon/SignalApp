type Entry<T> = { value: T; expiresAt: number };

export function peekCache<T>(map: Map<string, Entry<T>>, key: string): T | null {
  const e = map.get(key);
  if (e && Date.now() < e.expiresAt) return e.value;
  return null;
}

export function storeCache<T>(map: Map<string, Entry<T>>, key: string, value: T, ttlMs: number): void {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

