import type { SignalApiNewsDigestSourceRef, SignalApiNewsItem } from '@/integrations/signal-api/types';

export type NewsDigestItem = {
  id: string;
  title: string;
  summary: string;
  topics: string[];
  symbols: string[];
  sources: string[];
  count: number;
  score: number;
  aiGenerated: boolean;
  generatedAt: string | null;
  sourceRefs: SignalApiNewsDigestSourceRef[];
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
  'under',
  'market',
  'markets',
  'stock',
  'stocks',
  'shares',
  'news',
  'report',
  'reports',
  'reported',
  'according',
  'source',
  'sources',
  'official',
  'officials',
  'spokesperson',
  'ministry',
  'government',
  'administration',
  'senior',
  'says',
  'said',
  'will',
  'would',
  'could',
  'should',
  'likely',
  'unlikely',
  'fars',
  'reuters',
  'bloomberg',
  'information',
]);

const SHORT_KEYWORDS = new Set(['ai', 'us', 'uk', 'eu']);

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

function titleFocusText(item: SignalApiNewsItem): string {
  const raw = clean(item.title || item.originalTitle)
    .replace(/\s+-\s+[^-]+$/, '')
    .replace(/\s*:\s*(the information|fars news|reuters|bloomberg|cnbc|wsj|financial times|ft)$/i, '');
  const afterColon = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  return afterColon.length >= 12 ? afterColon : raw;
}

function keywordTokens(item: SignalApiNewsItem): string[] {
  const text = titleFocusText(item)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9가-힣\s]/g, ' ');
  const seen = new Set<string>();
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part || STOP_WORDS.has(part)) return false;
      if (part.length >= 3 || SHORT_KEYWORDS.has(part)) return true;
      return /[가-힣]/.test(part);
    })
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    });
}

function keywordKey(item: SignalApiNewsItem): string {
  const tokens = keywordTokens(item);
  if (tokens.length === 0) return 'market';
  return tokens.slice(0, 4).join(':');
}

function normalizedTitle(item: SignalApiNewsItem): string {
  return titleFocusText(item)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(item: SignalApiNewsItem): string {
  const raw = clean(item.sourceUrl);
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

function uniqueNewsItems(items: SignalApiNewsItem[]): SignalApiNewsItem[] {
  const seen = new Set<string>();
  const rows: SignalApiNewsItem[] = [];
  for (const item of items) {
    const title = normalizedTitle(item);
    const url = canonicalUrl(item);
    const key = url || `${sourceName(item).toLowerCase()}:${title}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(item);
  }
  return rows;
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
      const sorted = uniqueNewsItems([...group].sort((a, b) => publishedMs(b) - publishedMs(a)));
      const primary = sorted[0];
      const sources = [...new Set(sorted.map(sourceName))].slice(0, 4);
      const symbols = [...new Set(sorted.flatMap(normalizedSymbols))].slice(0, 6);
      const flashBonus = sorted.some((item) => normalizedTags(item).includes('속보')) ? 18 : 0;
      const volumeBonus = Math.min(48, sorted.length * 10);
      const sourceBonus = Math.min(20, sources.length * 5);
      const symbolBonus = Math.min(12, symbols.length * 3);
      const ageHours = Math.max(0, (Date.now() - publishedMs(primary)) / 3_600_000);
      const recencyBonus = Math.max(0, 50 - Math.floor(ageHours * 4));
      const score = volumeBonus + flashBonus + sourceBonus + symbolBonus + recencyBonus;
      return {
        id: `digest:${key}`,
        title: titleForGroup(primary, sorted),
        summary: '',
        topics: [],
        symbols,
        sources,
        count: sorted.length,
        score,
        aiGenerated: false,
        generatedAt: primary.publishedAt,
        sourceRefs: [],
        primary,
      };
    })
    .sort((a, b) => b.score - a.score || publishedMs(b.primary) - publishedMs(a.primary))
    .slice(0, limit);
}
