import { fh } from '@/integrations/finnhub/client';
import type { FinnhubMarketNewsCategory, FinnhubNewsRaw } from '@/integrations/finnhub/types';
import { toYmd } from '@/utils/date';

export async function fetchMarketNews(category: FinnhubMarketNewsCategory): Promise<FinnhubNewsRaw[]> {
  const data = await fh<FinnhubNewsRaw[]>('/news', { category });
  return Array.isArray(data) ? data : [];
}

export async function fetchCompanyNews(symbol: string, from: Date, to: Date): Promise<FinnhubNewsRaw[]> {
  const data = await fh<FinnhubNewsRaw[]>('/company-news', {
    symbol: symbol.trim().toUpperCase(),
    from: toYmd(from),
    to: toYmd(to),
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchGeneralNews(): Promise<FinnhubNewsRaw[]> {
  return fetchMarketNews('general');
}

export function mergeNewsById(...lists: FinnhubNewsRaw[][]): FinnhubNewsRaw[] {
  const map = new Map<number, FinnhubNewsRaw>();
  for (const list of lists) {
    for (const r of list) {
      if (!map.has(r.id)) map.set(r.id, r);
    }
  }
  return [...map.values()].sort((a, b) => b.datetime - a.datetime);
}
