const DEFAULT_USER_AGENT = 'SignalServer/0.1 RSS';

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

function stripCdata(inner) {
  return String(inner || '').replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/m, '$1').trim();
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function stableHash(value) {
  const s = String(value || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTag(block, tag) {
  const re = new RegExp(`<${escapeRegex(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`, 'i');
  const m = re.exec(block);
  if (!m) return '';
  return stripCdata(m[1]).trim();
}

function extractLink(block) {
  const explicit = extractTag(block, 'link');
  if (explicit) return explicit;
  const atomLink = /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (atomLink) return decodeEntities(atomLink[1]).trim();
  return '';
}

function parseDate(raw) {
  const t = Date.parse(String(raw || '').trim());
  if (!Number.isFinite(t)) return new Date().toISOString();
  return new Date(t).toISOString();
}

function normalizeKeywords(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function matchesKeywords(text, includeKeywords, excludeKeywords) {
  const haystack = String(text || '').toLowerCase();
  if (includeKeywords.length > 0 && !includeKeywords.some((keyword) => haystack.includes(keyword))) return false;
  if (excludeKeywords.length > 0 && excludeKeywords.some((keyword) => haystack.includes(keyword))) return false;
  return true;
}

function extractSymbols(text) {
  const source = String(text || '');
  const symbols = new Set();
  const patterns = [
    /\b(?:NASDAQ|NYSE|NYSEAMERICAN|AMEX|TSX|TSXV|CSE|OTC|OTCQX|OTCQB)\s*[:：]\s*([A-Z][A-Z0-9.-]{0,7})\b/g,
    /\(([A-Z][A-Z0-9.-]{0,7})\s*[:：]\s*(?:NASDAQ|NYSE|NYSEAMERICAN|AMEX|TSX|TSXV|CSE|OTC|OTCQX|OTCQB)\)/g,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(source)) !== null) {
      symbols.add(String(m[1] || '').replace(/[.-].*$/, '').toUpperCase());
    }
  }
  return [...symbols].slice(0, 8);
}

function normalizeRssItem({ item, params }) {
  const sourceName = String(params.sourceName || 'Newswire').trim() || 'Newswire';
  const providerId = String(params.providerId || sourceName).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'rss';
  const title = stripTags(item.title);
  const summary = stripTags(item.description || item.summary || item.content).slice(0, 2000);
  const sourceUrl = String(item.link || item.guid || '').trim();
  const providerItemId = String(item.guid || sourceUrl || title).trim();
  const id = `${providerId}-news-${stableHash(providerItemId || title)}`;
  const publishedAt = parseDate(item.pubDate || item.updated || item.published);
  const textForSymbols = `${title} ${summary}`;

  return {
    id,
    provider: providerId,
    providerItemId,
    category: String(params.category || 'global').trim() || 'global',
    titleOriginal: title,
    summaryOriginal: summary,
    contentOriginal: '',
    sourceName,
    sourceUrl,
    imageUrl: null,
    symbols: extractSymbols(textForSymbols),
    importance: null,
    publishedAt,
    fetchedAt: new Date().toISOString(),
    rawPayload: {
      sourceName,
      title: item.title,
      link: item.link,
      guid: item.guid,
      pubDate: item.pubDate,
      description: item.description,
    },
  };
}

function parseItems(xml) {
  const items = [];
  const rssRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = rssRe.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: extractTag(block, 'title'),
      link: extractLink(block),
      guid: extractTag(block, 'guid') || extractTag(block, 'id'),
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || extractTag(block, 'published') || extractTag(block, 'updated'),
      description: extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content:encoded') || extractTag(block, 'content'),
    });
  }

  const atomRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = atomRe.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: extractTag(block, 'title'),
      link: extractLink(block),
      guid: extractTag(block, 'id'),
      pubDate: extractTag(block, 'published') || extractTag(block, 'updated'),
      description: extractTag(block, 'summary') || extractTag(block, 'content'),
    });
  }

  return items;
}

export async function fetchNewswireRssNews(params = {}) {
  const feedUrl = String(params.feedUrl || '').trim();
  if (!feedUrl) throw new Error('RSS_FEED_URL_MISSING');
  const limit = Math.max(1, Math.min(100, Number(params.limit || 40) || 40));
  const daysBack = Math.max(0, Math.min(365, Number(params.daysBack || 0) || 0));
  const includeKeywords = normalizeKeywords(params.includeKeywords);
  const excludeKeywords = normalizeKeywords(params.excludeKeywords);
  const cutoffMs = daysBack > 0 ? Date.now() - daysBack * 24 * 60 * 60 * 1000 : 0;

  const res = await fetch(feedUrl, {
    headers: {
      'user-agent': String(params.userAgent || DEFAULT_USER_AGENT),
      accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RSS ${res.status}: ${body.slice(0, 200)}`);
  }

  const xml = await res.text();
  const rows = [];
  for (const item of parseItems(xml)) {
    if (!item.title && !item.link) continue;
    const text = `${stripTags(item.title)} ${stripTags(item.description)}`;
    if (!matchesKeywords(text, includeKeywords, excludeKeywords)) continue;
    const row = normalizeRssItem({ item, params });
    if (cutoffMs > 0 && Date.parse(row.publishedAt) < cutoffMs) continue;
    rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}
