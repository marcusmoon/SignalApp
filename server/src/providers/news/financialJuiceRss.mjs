const DEFAULT_FEED_URL = 'https://www.financialjuice.com/feed.ashx?xy=rss';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function stripFinancialJuiceTitlePrefix(value) {
  return String(value || '').replace(/^\s*Financial\s*Juice\s*:\s*/i, '').replace(/^\s*FinancialJuice\s*:\s*/i, '').trim();
}

function stripCdata(inner) {
  return String(inner || '').replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/m, '$1').trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(block);
  if (!m) return '';
  return stripCdata(m[1]).trim();
}

function stableIdFromLink(link) {
  const s = String(link || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `fj-${h.toString(16)}`;
}

function parsePubDate(raw) {
  const t = Date.parse(String(raw || '').trim());
  if (!Number.isFinite(t)) return new Date().toISOString();
  return new Date(t).toISOString();
}

/**
 * Parse RSS/Atom-ish XML and map items into the same news row shape as Finnhub items.
 */
export function normalizeFinancialJuiceRssItem({ title, link, pubDate, description }) {
  const sourceUrl = String(link || '').trim();
  const providerItemId = sourceUrl || String(title || '').slice(0, 120);
  const id = `financialjuice-news-${stableIdFromLink(sourceUrl || title)}`;
  return {
    id,
    provider: 'financialjuice',
    providerItemId,
    /** Same bucket as Finnhub general news; distinguish via `sourceName` / `provider`. */
    category: 'global',
    titleOriginal: stripFinancialJuiceTitlePrefix(stripTags(title)),
    summaryOriginal: stripTags(description).slice(0, 2000),
    contentOriginal: '',
    sourceName: 'Financial Juice',
    sourceUrl,
    imageUrl: null,
    symbols: [],
    importance: null,
    publishedAt: parsePubDate(pubDate),
    fetchedAt: new Date().toISOString(),
    rawPayload: { title, link, pubDate, description },
  };
}

export async function fetchFinancialJuiceRssNews(params = {}) {
  const feedUrl = String(params.feedUrl || DEFAULT_FEED_URL).trim() || DEFAULT_FEED_URL;
  const limit = Math.max(1, Math.min(80, Number(params.limit || 40) || 40));
  const maxRetries = Math.max(0, Math.min(4, Number(params.maxRetries ?? 3)));
  const baseDelayMs = Math.max(250, Math.min(10_000, Number(params.baseDelayMs ?? 800)));

  let res = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    res = await fetch(feedUrl, {
      headers: {
        'user-agent': 'SignalServer/0.1 RSS',
        accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
      },
    });

    // FinancialJuice occasionally rate-limits RSS (429). Treat as a soft-failure:
    // backoff + retry, then return empty list so the job run is not permanently "failed".
    if (res.status === 429) {
      if (attempt >= maxRetries) {
        console.warn(`[financialJuiceRss] rate limited (429). Skipping this run. feedUrl=${feedUrl}`);
        return [];
      }
      const retryAfter = Number(res.headers.get('retry-after') || '');
      const retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 0;
      const expo = baseDelayMs * (2 ** attempt);
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.max(retryAfterMs, expo) + jitter;
      await sleep(delay);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`RSS ${res.status}: ${body.slice(0, 200)}`);
    }

    break;
  }

  const xml = await res.text();
  const items = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'updated');
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    if (!title && !link) continue;
    items.push(normalizeFinancialJuiceRssItem({ title, link, pubDate, description }));
  }
  return items;
}
