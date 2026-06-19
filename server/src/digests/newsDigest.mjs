import crypto from 'node:crypto';

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

function clean(value) {
  return String(value || '').trim();
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function sourceName(item) {
  return clean(item.sourceName) || clean(item.provider) || 'Unknown';
}

function normalizedSymbols(item) {
  return Array.isArray(item?.symbols)
    ? [...new Set(item.symbols.map((symbol) => clean(symbol).toUpperCase()).filter(Boolean))]
    : [];
}

function normalizedTags(item) {
  return Array.isArray(item?.hashtags)
    ? item.hashtags.map((tag) => clean(tag?.label || tag).toLowerCase()).filter(Boolean)
    : [];
}

function titleFocusText(item) {
  const raw = (clean(item?.title) || clean(item?.titleOriginal) || clean(item?.originalTitle))
    .replace(/\s+-\s+[^-]+$/, '')
    .replace(/\s*:\s*(the information|fars news|reuters|bloomberg|cnbc|wsj|financial times|ft)$/i, '');
  const afterColon = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  return afterColon.length >= 12 ? afterColon : raw;
}

function keywordTokens(item) {
  const text = titleFocusText(item)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9가-힣\s]/g, ' ');
  const seen = new Set();
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

function keywordKey(item) {
  const tokens = keywordTokens(item);
  if (tokens.length === 0) return 'market';
  return tokens.slice(0, 4).join(':');
}

function normalizedTitle(item) {
  return titleFocusText(item)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(item) {
  const raw = clean(item?.sourceUrl || item?.url);
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

function uniqueNewsItems(items) {
  const seen = new Set();
  const rows = [];
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

function digestKey(item) {
  const symbols = normalizedSymbols(item);
  if (symbols.length > 0) return `symbol:${symbols[0]}`;
  const tags = normalizedTags(item);
  if (tags.length > 0) return `tag:${tags[0]}`;
  return `keyword:${keywordKey(item)}`;
}

function itemMs(item) {
  const ms = new Date(item?.publishedAt || item?.fetchedAt || item?.createdAt || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function itemDate(item) {
  const ms = itemMs(item);
  return ms > 0 ? new Date(ms).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function itemTitle(item) {
  return clean(item?.title) || clean(item?.titleOriginal) || clean(item?.originalTitle);
}

function isRecent(item, minMs) {
  const ms = itemMs(item);
  return ms > 0 && ms >= minMs;
}

function categoryOf(item) {
  const category = clean(item?.category).toLowerCase();
  if (category === 'crypto') return 'crypto';
  if (category === 'korea') return 'korea';
  return 'global';
}

function isFlash(item) {
  const title = itemTitle(item).toLowerCase();
  const category = clean(item?.category).toLowerCase();
  return (
    category === 'breaking' ||
    category === 'flash' ||
    category === 'hot' ||
    /breaking|flash|속보|긴급|urgent|market alert|just in|developing/.test(title) ||
    normalizedTags(item).includes('속보')
  );
}

function sourceRef(item) {
  return {
    type: 'news',
    id: item.id,
    title: itemTitle(item),
    url: item.sourceUrl || item.url || null,
    sourceName: sourceName(item),
    publishedAt: item.publishedAt || null,
  };
}

export function generateNewsDigestItems(db = {}, params = {}) {
  const hoursBack = Math.max(1, Math.min(168, Number(params.hoursBack) || 24));
  const sourceLimit = Math.max(20, Math.min(500, Number(params.sourceLimit) || 180));
  const maxItemsPerCategory = Math.max(1, Math.min(12, Number(params.maxItemsPerCategory) || 6));
  const categories = new Set(
    (Array.isArray(params.categories) && params.categories.length > 0 ? params.categories : ['global', 'crypto', 'korea'])
      .map((category) => clean(category).toLowerCase())
      .filter(Boolean),
  );
  const generatedAt = new Date().toISOString();
  const generatedDate = generatedAt.slice(0, 10);
  const minMs = Date.now() - hoursBack * 60 * 60 * 1000;
  const rows = Array.isArray(db.newsItems) ? db.newsItems : [];
  const groups = new Map();

  for (const item of rows
    .filter((row) => row?.id && itemTitle(row) && isRecent(row, minMs))
    .sort((a, b) => itemMs(b) - itemMs(a))
    .slice(0, sourceLimit)) {
    const category = categoryOf(item);
    if (!categories.has(category)) continue;
    const key = `${category}:${digestKey(item)}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const byCategory = new Map();
  for (const [key, group] of groups.entries()) {
    const sorted = uniqueNewsItems([...group].sort((a, b) => itemMs(b) - itemMs(a)));
    if (sorted.length === 0) continue;
    const primary = sorted[0];
    const category = categoryOf(primary);
    const sources = [...new Set(sorted.map(sourceName))].slice(0, 5);
    const symbols = [...new Set(sorted.flatMap(normalizedSymbols))].slice(0, 8);
    const tags = [...new Set(sorted.flatMap(normalizedTags))].slice(0, 8);
    const flashBonus = sorted.some(isFlash) ? 18 : 0;
    const volumeBonus = Math.min(48, sorted.length * 10);
    const sourceBonus = Math.min(20, sources.length * 5);
    const symbolBonus = Math.min(12, symbols.length * 3);
    const ageHours = Math.max(0, (Date.now() - itemMs(primary)) / 3_600_000);
    const recencyBonus = Math.max(0, 50 - Math.floor(ageHours * 4));
    const score = volumeBonus + flashBonus + sourceBonus + symbolBonus + recencyBonus;
    const digestId = `news-digest:${generatedDate}:${hash(key)}`;
    const item = {
      id: digestId,
      category,
      title: itemTitle(primary),
      summary: `${sorted.length}개 뉴스 · ${sources.length}개 출처`,
      symbols,
      sources,
      topics: tags,
      count: sorted.length,
      score,
      generatedDate,
      generatedAt,
      primaryNewsId: primary.id,
      primaryPublishedAt: primary.publishedAt || null,
      groupKey: key,
      sourceRefs: sorted.slice(0, 8).map(sourceRef),
      updatedAt: generatedAt,
    };
    const bucket = byCategory.get(category) || [];
    bucket.push(item);
    byCategory.set(category, bucket);
  }

  return [...byCategory.values()]
    .flatMap((items) =>
      items
        .sort((a, b) => b.score - a.score || String(b.primaryPublishedAt || '').localeCompare(String(a.primaryPublishedAt || '')))
        .slice(0, maxItemsPerCategory),
    )
    .sort((a, b) => String(a.category).localeCompare(String(b.category)) || b.score - a.score);
}
