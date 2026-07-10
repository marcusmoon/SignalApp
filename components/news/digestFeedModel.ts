import type { NewsDigestItem } from '@/domain/news';
import type { SignalApiNewsDigestItem, SignalApiNewsItem } from '@/integrations/signal-api/types';

export function digestSourceUrl(item: SignalApiNewsDigestItem): string {
  return item.sourceRefs?.find((ref) => ref.url)?.url?.trim() || '';
}

export function digestPrimaryNews(
  item: SignalApiNewsDigestItem,
  rows: SignalApiNewsItem[],
): SignalApiNewsItem {
  const primaryId = item.primaryNewsId?.trim();
  if (primaryId) {
    const hit = rows.find((row) => row.id === primaryId);
    if (hit) return hit;
  }
  const sourceRef = item.sourceRefs?.[0];
  const now = item.generatedAt || new Date().toISOString();
  return {
    id: primaryId || item.id,
    category: item.category || 'global',
    title: item.title,
    summary: item.summary,
    originalTitle: item.title,
    originalSummary: item.summary,
    sourceName: sourceRef?.sourceName || item.sources?.[0] || '',
    sourceUrl: sourceRef?.url || digestSourceUrl(item),
    imageUrl: null,
    symbols: item.symbols || [],
    hashtags: (item.topics || []).map((label, order) => ({ label, order, source: 'auto' as const })),
    provider: 'signal',
    publishedAt: sourceRef?.publishedAt || item.generatedAt,
    fetchedAt: now,
  };
}

export function digestFromServer(
  item: SignalApiNewsDigestItem,
  rows: SignalApiNewsItem[],
): NewsDigestItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    topics: item.topics || [],
    symbols: item.symbols || [],
    sources: item.sources || [],
    count: item.count,
    score: item.count,
    aiGenerated: Boolean(item.aiGenerated),
    generatedAt: item.generatedAt,
    sourceRefs: item.sourceRefs,
    primary: digestPrimaryNews(item, rows),
  };
}

export function collectDigestReferencedNewsIds(items: SignalApiNewsDigestItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.primaryNewsId?.trim()) ids.add(item.primaryNewsId.trim());
    for (const ref of item.sourceRefs || []) {
      const newsId = ref.newsId?.trim() || ref.id?.trim();
      if (newsId) ids.add(newsId);
    }
  }
  return ids;
}

/** 15분 단위로 `to`를 맞춰 digest 캐시 키가 매 요청마다 바뀌지 않게 한다. */
const DIGEST_RANGE_BUCKET_MS = 15 * 60 * 1000;

export function utcRangeLastHours(hours: number): { from: string; to: string } {
  const toMs = Math.floor(Date.now() / DIGEST_RANGE_BUCKET_MS) * DIGEST_RANGE_BUCKET_MS;
  const to = new Date(toMs);
  const from = new Date(toMs - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function isNewsPublishedWithinHours(
  item: SignalApiNewsItem,
  hours: number,
  nowMs = Date.now(),
): boolean {
  const raw = item.publishedAt?.trim();
  if (!raw) return true;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return true;
  return nowMs - ts <= hours * 60 * 60 * 1000;
}

export function mergeNewsRows(
  existing: SignalApiNewsItem[],
  incoming: SignalApiNewsItem[],
): SignalApiNewsItem[] {
  if (incoming.length === 0) return existing;
  const ids = new Set(existing.map((row) => row.id));
  const added = incoming.filter((row) => !ids.has(row.id));
  return added.length > 0 ? [...existing, ...added] : existing;
}

export function filterRealtimeNewsRows(
  rows: SignalApiNewsItem[],
  digests: SignalApiNewsDigestItem[],
): SignalApiNewsItem[] {
  const ids = collectDigestReferencedNewsIds(digests);
  const urlKeys = new Set<string>();
  for (const digest of digests) {
    for (const ref of digest.sourceRefs || []) {
      const url = ref.url?.trim().toLowerCase();
      if (url) urlKeys.add(url);
    }
  }
  return rows.filter((row) => {
    if (ids.has(row.id)) return false;
    const url = row.sourceUrl?.trim().toLowerCase();
    if (url && urlKeys.has(url)) return false;
    return true;
  });
}
