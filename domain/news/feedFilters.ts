import type { MessageId } from '@/locales/messages';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';
import type { NewsSegmentKey } from '@/constants/newsSegment';

export const FEED_PAGE_ALL = 30;
export const FEED_PAGE_GLOBAL = 20;
export const FEED_PAGE_KOREA = 20;
export const FEED_PAGE_IT = 40;
export const FEED_PAGE_CRYPTO = 25;
export const FEED_PAGE_VIDEO = 20;

export const NEWS_SEGMENT_LABEL: Record<NewsSegmentKey, MessageId> = {
  all: 'feedSegmentAll',
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
  it: 'feedSegmentIt',
  video: 'feedSegmentVideo',
};

/** API `category` for article segments (`all` aggregates on server). */
export function newsApiCategoryForSegment(segment: NewsSegmentKey): string | null {
  if (segment === 'video') return null;
  return segment;
}

export function newsFeedPageLimit(segment: NewsSegmentKey): number {
  switch (segment) {
    case 'all':
      return FEED_PAGE_ALL;
    case 'it':
      return FEED_PAGE_IT;
    case 'crypto':
      return FEED_PAGE_CRYPTO;
    case 'korea':
      return FEED_PAGE_KOREA;
    case 'video':
      return FEED_PAGE_VIDEO;
    case 'global':
    default:
      return FEED_PAGE_GLOBAL;
  }
}

function cleanFeedText(value: unknown): string {
  return String(value || '').trim();
}

/** Canonical story URL — strips tracking/query noise so duplicate provider rows collapse. */
export function newsFeedCanonicalUrl(item: SignalApiNewsItem): string {
  const raw = cleanFeedText(item.sourceUrl);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|xy$|oc$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    const query = url.searchParams.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

export function newsFeedDedupeKey(item: SignalApiNewsItem): string {
  const url = newsFeedCanonicalUrl(item);
  if (url) return url.toLowerCase();
  const title = cleanFeedText(item.originalTitle || item.title)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const source = cleanFeedText(item.sourceName).toLowerCase();
  return `${source}:${title}`;
}

/** Remove duplicate stories (same canonical URL/title) while preserving feed order. */
export function dedupeNewsFeedRows(rows: SignalApiNewsItem[]): SignalApiNewsItem[] {
  const seen = new Set<string>();
  const out: SignalApiNewsItem[] = [];
  for (const row of rows) {
    const key = newsFeedDedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Append feed rows by id — duplicate provider copies must not block pagination advance. */
export function appendUniqueNewsRows(
  existing: SignalApiNewsItem[],
  incoming: SignalApiNewsItem[],
): { merged: SignalApiNewsItem[]; addedCount: number } {
  if (incoming.length === 0) {
    return { merged: existing, addedCount: 0 };
  }
  const seenIds = new Set(existing.map((row) => row.id));
  const seenKeys = new Set(existing.map((row) => newsFeedDedupeKey(row)));
  const added: SignalApiNewsItem[] = [];
  for (const row of incoming) {
    const key = newsFeedDedupeKey(row);
    if (seenIds.has(row.id) || seenKeys.has(key)) continue;
    seenIds.add(row.id);
    seenKeys.add(key);
    added.push(row);
  }
  return { merged: [...existing, ...added], addedCount: added.length };
}
