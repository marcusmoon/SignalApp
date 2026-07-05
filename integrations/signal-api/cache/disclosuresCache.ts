import type { SignalApiDisclosure, SignalNewsListMeta } from '@/integrations/signal-api/types';
import { peekCache, storeCache } from '@/integrations/signal-api/cache/common';

export const SIGNAL_DISCLOSURES_CACHE_TTL_MS = 2 * 60 * 1000;

type DisclosuresCacheValue = { items: SignalApiDisclosure[]; meta: SignalNewsListMeta };
const disclosuresCache = new Map<string, { value: DisclosuresCacheValue; expiresAt: number }>();

export function buildSignalDisclosuresCacheKey(params?: {
  market?: string;
  provider?: string;
  formType?: string;
  typeCategory?: string;
  symbol?: string;
  symbols?: string;
  q?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}): string {
  const p = {
    market: String(params?.market || '').trim().toLowerCase(),
    provider: String(params?.provider || '').trim().toLowerCase(),
    formType: String(params?.formType || '').trim(),
    typeCategory: String(params?.typeCategory || '').trim(),
    symbol: String(params?.symbol || '').trim().toUpperCase(),
    symbols: String(params?.symbols || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .sort()
      .join(','),
    q: String(params?.q || '').trim(),
    limit: Number(params?.limit) || 0,
    offset: Number(params?.offset) || 0,
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
  };
  return `disclosures|${p.market}|${p.provider}|${p.formType}|${p.typeCategory}|${p.symbol}|${p.symbols}|${p.q}|${p.limit}|${p.offset}|${p.from}|${p.to}`;
}

export function peekSignalDisclosuresCache(key: string): DisclosuresCacheValue | null {
  return peekCache(disclosuresCache, key);
}

export function storeSignalDisclosuresCache(key: string, value: DisclosuresCacheValue): void {
  storeCache(disclosuresCache, key, value, SIGNAL_DISCLOSURES_CACHE_TTL_MS);
}

export function clearSignalDisclosuresCache(): void {
  disclosuresCache.clear();
}
