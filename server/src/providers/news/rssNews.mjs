const DEFAULT_USER_AGENT = 'SignalServer/0.1 RSS';

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

const KOREA_SYMBOL_ALIASES = [
  ['005930', ['005930', '삼성전자', 'samsung electronics', 'samsung elec']],
  ['000660', ['000660', 'sk하이닉스', 'sk hynix']],
  ['402340', ['402340', 'sk스퀘어', 'sk square']],
  ['005380', ['005380', '현대차', '현대자동차', 'hyundai motor']],
  ['009150', ['009150', '삼성전기', 'samsung electro']],
  ['373220', ['373220', 'lg에너지솔루션', 'lg energy solution', 'lg energy']],
  ['032830', ['032830', '삼성생명', 'samsung life']],
  ['028260', ['028260', '삼성물산', 'samsung c&t']],
  ['329180', ['329180', 'hd현대중공업', 'hd hhi']],
  ['105560', ['105560', 'kb금융', 'kb financial']],
  ['012330', ['012330', '현대모비스', 'hyundai mobis']],
  ['000270', ['000270', '기아', 'kia']],
  ['207940', ['207940', '삼성바이오로직스', 'samsung biologics']],
  ['034020', ['034020', '두산에너빌리티', 'doosan enerbility']],
  ['012450', ['012450', '한화에어로스페이스', 'hanwha aerospace']],
  ['055550', ['055550', '신한지주', 'shinhan financial']],
  ['066570', ['066570', 'lg전자', 'lg electronics']],
  ['006400', ['006400', '삼성sdi', 'samsung sdi']],
  ['034730', ['034730', 'sk inc']],
  ['035420', ['035420', '네이버', 'naver']],
];

function extractSymbols(text) {
  const source = String(text || '');
  const lowerSource = source.toLowerCase();
  const symbols = new Set();
  const patterns = [
    /\b(?:NASDAQ|NYSE|NYSEAMERICAN|AMEX|TSX|TSXV|CSE|OTC|OTCQX|OTCQB)\s*[:：]\s*([A-Z][A-Z0-9.-]{0,7})\b/g,
    /\(([A-Z][A-Z0-9.-]{0,7})\s*[:：]\s*(?:NASDAQ|NYSE|NYSEAMERICAN|AMEX|TSX|TSXV|CSE|OTC|OTCQX|OTCQB)\)/g,
    /\b([0-9]{6})\b/g,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(source)) !== null) {
      symbols.add(String(m[1] || '').replace(/[.-].*$/, '').toUpperCase());
    }
  }
  for (const [symbol, aliases] of KOREA_SYMBOL_ALIASES) {
    if (aliases.some((alias) => lowerSource.includes(String(alias).toLowerCase()))) {
      symbols.add(symbol);
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

/** 저장된 RSS 뉴스를 rawPayload 기준으로 재보정 (reconcile phase). */
export function reconcileRssNewsItems(items, { providerIds = [], limit = 60 } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const providerFilter = new Set(
    (Array.isArray(providerIds) ? providerIds : [])
      .map((id) => String(id || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const reconciledAt = new Date().toISOString();
  return [...(Array.isArray(items) ? items : [])]
    .filter((item) => {
      if (providerFilter.size === 0) return true;
      return providerFilter.has(String(item?.provider || '').trim().toLowerCase());
    })
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0, safeLimit)
    .map((item) => {
      const raw = item?.rawPayload && typeof item.rawPayload === 'object' ? item.rawPayload : {};
      const params = {
        sourceName: raw.sourceName || item.sourceName || 'Newswire',
        providerId: item.provider,
        category: item.category || 'global',
      };
      const normalized = normalizeRssItem({
        item: {
          title: raw.title || item.titleOriginal || '',
          link: raw.link || item.sourceUrl || '',
          guid: raw.guid || item.providerItemId || '',
          pubDate: raw.pubDate || item.publishedAt || '',
          description: raw.description || item.summaryOriginal || '',
        },
        params,
      });
      return {
        ...normalized,
        id: item.id,
        createdAt: item.createdAt || reconciledAt,
        fetchedAt: reconciledAt,
      };
    });
}

export async function fetchNewswireRssNews(params = {}) {
  const feedUrl = String(params.feedUrl || '').trim();
  if (!feedUrl) throw new Error('RSS_FEED_URL_MISSING');
  const limit = Math.max(1, Math.min(100, Number(params.limit || 40) || 40));
  const daysBack = Math.max(0, Math.min(365, Number(params.daysBack || 0) || 0));
  const includeKeywords = normalizeKeywords(params.includeKeywords);
  const excludeKeywords = normalizeKeywords(params.excludeKeywords);
  const cutoffMs = daysBack > 0 ? Date.now() - daysBack * 24 * 60 * 60 * 1000 : 0;
  const maxRetries = Math.max(0, Math.min(4, Number(params.maxRetries ?? 3)));
  const baseDelayMs = Math.max(250, Math.min(10_000, Number(params.baseDelayMs ?? 800)));
  const timeoutMs = Math.max(5_000, Math.min(120_000, Number(params.timeoutMs ?? 30_000)));

  let res = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      res = await fetch(feedUrl, {
        headers: {
          'user-agent': String(params.userAgent || DEFAULT_USER_AGENT),
          accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt >= maxRetries) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`RSS fetch failed: ${message}`);
      }
      const expo = baseDelayMs * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 200);
      await sleep(expo + jitter);
      continue;
    }

    if (res.status === 429) {
      if (attempt >= maxRetries) {
        console.warn(`[rssNews] rate limited (429). Skipping this feed. feedUrl=${feedUrl}`);
        return [];
      }
      const retryAfter = Number(res.headers.get('retry-after') || '');
      const retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 0;
      const expo = baseDelayMs * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 200);
      await sleep(Math.max(retryAfterMs, expo) + jitter);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`RSS ${res.status}: ${body.slice(0, 200)}`);
    }

    break;
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
