import type { SignalApiNewsDigestItem } from '../../integrations/signal-api/types.ts';

export type SavedNews = { item: SignalApiNewsDigestItem; savedAt: number };
export const savedNewsKey = (item: SignalApiNewsDigestItem) => item.storyId || item.id;

export function cleanSavedNews(value: unknown): SavedNews[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((row): row is SavedNews => {
    if (!row || typeof row !== 'object' || !Number.isFinite(row.savedAt)) return false;
    const item = row.item;
    if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.summary !== 'string' ||
      !['global', 'korea', 'crypto'].includes(item.category) || !Array.isArray(item.sourceRefs) || !Array.isArray(item.sources) || !Array.isArray(item.symbols)) return false;
    return true;
  }).sort((a, b) => b.savedAt - a.savedAt).filter(({ item }) => {
    const key = savedNewsKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 100);
}
