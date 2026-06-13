import type { SignalApiNewsItem } from '@/integrations/signal-api/types';

export type NewsDigestItem = {
  id: string;
  title: string;
  symbols: string[];
  sources: string[];
  count: number;
  score: number;
  primary: SignalApiNewsItem;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'after',
  'over',
  'into',
  'market',
  'markets',
  'stock',
  'stocks',
  'shares',
  'news',
]);

function clean(value: unknown): string {
  return String(value || '').trim();
}

function sourceName(item: SignalApiNewsItem): string {
  return clean(item.sourceName) || 'Unknown';
}

function normalizedSymbols(item: SignalApiNewsItem): string[] {
  return Array.isArray(item.symbols)
    ? [...new Set(item.symbols.map((symbol) => clean(symbol).toUpperCase()).filter(Boolean))]
    : [];
}

function normalizedTags(item: SignalApiNewsItem): string[] {
  return Array.isArray(item.hashtags)
    ? item.hashtags.map((tag) => clean(tag.label).toLowerCase()).filter(Boolean)
    : [];
}

function keywordKey(item: SignalApiNewsItem): string {
  const text = `${item.title || ''} ${item.originalTitle || ''}`
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9가-힣\s]/g, ' ');
  const token = text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part))
    .sort((a, b) => b.length - a.length)[0];
  return token || 'market';
}

function digestKey(item: SignalApiNewsItem): string {
  const symbols = normalizedSymbols(item);
  if (symbols.length > 0) return `symbol:${symbols[0]}`;
  const tags = normalizedTags(item);
  if (tags.length > 0) return `tag:${tags[0]}`;
  return `keyword:${keywordKey(item)}`;
}

function publishedMs(item: SignalApiNewsItem): number {
  const ms = new Date(item.publishedAt || item.fetchedAt || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function titleForGroup(primary: SignalApiNewsItem, rows: SignalApiNewsItem[]): string {
  const title = clean(primary.title || primary.originalTitle);
  return title;
}

export function buildNewsDigestItems(rows: SignalApiNewsItem[], limit = 4): NewsDigestItem[] {
  const groups = new Map<string, SignalApiNewsItem[]>();
  for (const row of rows.slice(0, 80)) {
    const key = digestKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const sorted = [...group].sort((a, b) => publishedMs(b) - publishedMs(a));
      const primary = sorted[0];
      const sources = [...new Set(sorted.map(sourceName))].slice(0, 4);
      const symbols = [...new Set(sorted.flatMap(normalizedSymbols))].slice(0, 6);
      const flashBonus = sorted.some((item) => normalizedTags(item).includes('속보')) ? 18 : 0;
      const sourceBonus = Math.min(20, sources.length * 5);
      const symbolBonus = Math.min(12, symbols.length * 3);
      const recencyBonus = Math.max(0, 12 - Math.floor((Date.now() - publishedMs(primary)) / 3_600_000));
      const score = sorted.length * 16 + flashBonus + sourceBonus + symbolBonus + recencyBonus;
      return {
        id: `digest:${key}`,
        title: titleForGroup(primary, sorted),
        symbols,
        sources,
        count: sorted.length,
        score,
        primary,
      };
    })
    .sort((a, b) => b.score - a.score || publishedMs(b.primary) - publishedMs(a.primary))
    .slice(0, limit);
}
