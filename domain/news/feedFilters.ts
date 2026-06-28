import type { MessageId } from '@/locales/messages';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import { isFlashNews } from './flash';

export const FEED_PAGE_GLOBAL = 20;
export const FEED_PAGE_KOREA = 20;
export const FEED_PAGE_WATCH = 40;
export const FEED_PAGE_CRYPTO = 25;
export const FEED_PAGE_VIDEO = 20;
export const SOURCE_PROBE_LIMIT = 100;
export const EMPTY_FILTER_SENTINEL = '__signal_no_match__';

export const NEWS_SEGMENT_LABEL: Record<NewsSegmentKey, MessageId> = {
  watch: 'feedSegmentWatch',
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
  video: 'feedSegmentVideo',
};

export type NewsQuickFilterKind = 'all' | 'flash' | 'sources';
export type WatchFilterKind = 'all' | 'symbols';

export const NEWS_QUICK_FILTERS: { key: NewsQuickFilterKind; labelId: MessageId }[] = [
  { key: 'all', labelId: 'feedWatchFilterAll' },
  { key: 'flash', labelId: 'feedWatchFilterFlash' },
  { key: 'sources', labelId: 'feedWatchFilterSources' },
];

export const WATCH_FILTERS: { key: WatchFilterKind; labelId: MessageId }[] = [
  { key: 'all', labelId: 'feedWatchFilterAll' },
  { key: 'symbols', labelId: 'feedWatchFilterSymbols' },
];

export function signalSourceLabel(item: SignalApiNewsItem): string {
  const source = String(item.sourceName || '').trim();
  return source.length > 0 ? source : 'Unknown';
}

export function uniqueSignalSources(items: SignalApiNewsItem[]): string[] {
  return [...new Set(items.map(signalSourceLabel))].sort((a, b) => a.localeCompare(b));
}

export function buildSourcesFromCatalog(params: {
  rawSources: string[];
  catalog: { name: string; enabled: boolean; order: number }[];
}): string[] {
  const { rawSources, catalog } = params;
  const enabledCatalog = (catalog || [])
    .filter((source) => source && source.enabled)
    .slice()
    .sort(
      (a, b) =>
        (Number(a.order) || 0) - (Number(b.order) || 0) ||
        String(a.name).localeCompare(String(b.name)),
    )
    .map((source) => String(source.name || '').trim())
    .filter((source) => source.length > 0);

  const set = new Set(enabledCatalog);
  const extras = rawSources.filter((source) => !set.has(source));
  const out = [...enabledCatalog, ...extras];
  return out.length > 0 ? out : rawSources;
}

export function normalizeNullableSelection(options: string[], selected: string[] | null): string[] {
  if (selected == null) return options;
  const allowed = new Set(options);
  return selected.filter((item) => allowed.has(item));
}

export function sourceFilterParam(options: string[], selected: string[] | null): string | undefined {
  const normalized = normalizeNullableSelection(options, selected);
  if (normalized.length === options.length) return undefined;
  return normalized.length > 0 ? normalized.join(',') : EMPTY_FILTER_SENTINEL;
}

export function filterNewsRows(
  rows: SignalApiNewsItem[],
  params: {
    kind: NewsQuickFilterKind;
    sourceOptions: string[];
    selectedSources: string[] | null;
  },
): SignalApiNewsItem[] {
  if (params.kind === 'all') return rows;
  if (params.kind === 'flash') return rows.filter((row) => isFlashNews(row));
  const selectedSources = new Set(normalizeNullableSelection(params.sourceOptions, params.selectedSources));
  if (selectedSources.size === 0) return [];
  return rows.filter((row) => selectedSources.has(signalSourceLabel(row)));
}

export function filterWatchRows(
  rows: SignalApiNewsItem[],
  params: {
    kind: WatchFilterKind;
    symbolOptions: string[];
    selectedSymbols: string[] | null;
  },
): SignalApiNewsItem[] {
  if (params.kind === 'all') return rows;
  const selected = new Set(
    normalizeNullableSelection(params.symbolOptions, params.selectedSymbols).map((symbol) =>
      symbol.toUpperCase(),
    ),
  );
  if (selected.size === 0) return [];
  return rows.filter((row) => {
    const symbols = Array.isArray(row.symbols) ? row.symbols : [];
    return symbols.some((symbol) => selected.has(String(symbol).trim().toUpperCase()));
  });
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
