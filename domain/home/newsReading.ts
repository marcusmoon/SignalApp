import type { SignalApiNewsDigestItem } from '../../integrations/signal-api/types.ts';

export type HomeNewsRow = {
  category: 'global' | 'korea' | 'crypto';
  item: SignalApiNewsDigestItem;
};
export type NewsReadHistory = Record<string, { revision: string; readAt: number }>;
export const NEWS_READ_HISTORY_LIMIT = 300;

/** Match declared symbols only. Never infer a holding from a title substring. */
function symbolKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^KRX:/, '')
    .replace(/\.(KS|KQ)$/, '');
}

export function matchingWatchSymbols(
  item: Pick<SignalApiNewsDigestItem, 'symbols'>,
  watchlist: readonly string[],
): string[] {
  const watching = new Set(watchlist.map(symbolKey));
  return [...new Set(item.symbols.map(symbolKey).filter((s) => s && watching.has(s)))];
}

export function selectHomeNews(
  rows: readonly HomeNewsRow[],
  watchlist: readonly string[],
  scope: 'all' | 'watch',
  limit: number,
): HomeNewsRow[] {
  const seen = new Set<string>();
  return [...rows]
    .filter((row) => scope === 'all' || matchingWatchSymbols(row.item, watchlist).length > 0)
    .sort((a, b) => {
      const time = (row: HomeNewsRow) =>
        Date.parse(row.item.generatedAt || row.item.generatedDate || '') || 0;
      return time(b) - time(a) || a.item.id.localeCompare(b.item.id);
    })
    .filter(({ item }) => {
      const key = item.storyId || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function newsReadKey(id: string, locale: string): string {
  return `${locale}:${id}`;
}

/** Local change detector, not a security hash. Updated copy becomes unread again. */
export function newsReadRevision(
  item: Pick<SignalApiNewsDigestItem, 'generatedAt' | 'title' | 'summary' | 'revisionId'>,
): string {
  if (item.revisionId) return item.revisionId;
  const content = JSON.stringify([item.generatedAt, item.title, item.summary]);
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export function hasReadNews(
  history: NewsReadHistory,
  item: SignalApiNewsDigestItem,
  locale: string,
): boolean {
  return history[newsReadKey(item.storyId || item.id, locale)]?.revision === newsReadRevision(item);
}

export function pruneNewsReadHistory(value: unknown): NewsReadHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, { revision: string; readAt: number }] => {
        const row = entry[1];
        return (
          row &&
          typeof row === 'object' &&
          typeof row.revision === 'string' &&
          Number.isFinite(row.readAt)
        );
      })
      .sort((a, b) => b[1].readAt - a[1].readAt)
      .slice(0, NEWS_READ_HISTORY_LIMIT),
  );
}
