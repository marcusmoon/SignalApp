import { hashtagLabelsForFilter, sortedHashtagsForPublic } from '../newsHashtags.mjs';
import { stripFinancialJuiceTitlePrefix } from '../providers/news/financialJuiceRss.mjs';
import { itemMatchesYoutubeChannelHandles } from '../youtubeCuration.mjs';

export function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export function paginate(rows, url, defaultPageSize = 30, maxPageSize = 100) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || String(defaultPageSize), 10) || defaultPageSize),
  );
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    rows: rows.slice(start, start + pageSize),
  };
}

export function cleanTranslationText(value) {
  return String(value || '')
    .replace(/^\s*\[번역 대기\]\s*/u, '')
    .replace(/^\s*\[翻訳待ち\]\s*/u, '')
    .trim();
}

export function cleanNewsTitleForDisplay(item, value) {
  const cleaned = cleanTranslationText(value);
  if (String(item?.provider || '').toLowerCase() === 'financialjuice') {
    return stripFinancialJuiceTitlePrefix(cleaned);
  }
  return cleaned;
}

function utcDateKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || '').slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isAtOrAfter(value, boundary) {
  if (!value || !boundary) return true;
  if (isDateOnly(boundary)) return utcDateKey(value) >= boundary;
  const valueMs = new Date(value).getTime();
  const boundaryMs = new Date(boundary).getTime();
  return !Number.isFinite(valueMs) || !Number.isFinite(boundaryMs) || valueMs >= boundaryMs;
}

function isAtOrBefore(value, boundary) {
  if (!value || !boundary) return true;
  if (isDateOnly(boundary)) return utcDateKey(value) <= boundary;
  const valueMs = new Date(value).getTime();
  const boundaryMs = new Date(boundary).getTime();
  return !Number.isFinite(valueMs) || !Number.isFinite(boundaryMs) || valueMs <= boundaryMs;
}

export function hasUsableTranslation(tr, item) {
  if (!tr || !(tr.status === 'completed' || tr.status === 'manual')) return false;
  if (tr.provider === 'mock') return false;
  const title = cleanNewsTitleForDisplay(item, tr.title);
  const summary = cleanTranslationText(tr.summary);
  if (!title && !summary) return false;
  if (
    title === cleanNewsTitleForDisplay(item, item.titleOriginal) &&
    summary === String(item.summaryOriginal || '').trim() &&
    tr.provider !== 'manual'
  ) {
    return false;
  }
  return true;
}

function titlesDiffer(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) !== 0;
}

/** Card title toggle — ko/ja show English original; en shows Korean translation when available. */
export function resolveAlternateTitle(item, translations, locale, displayed) {
  const titleOriginal = cleanNewsTitleForDisplay(item, item.titleOriginal);
  if (locale === 'ko' || locale === 'ja') {
    return titlesDiffer(displayed.title, titleOriginal) ? titleOriginal : null;
  }
  if (locale === 'en') {
    const koTr = translations.find((t) => t.newsItemId === item.id && t.locale === 'ko');
    if (!hasUsableTranslation(koTr, item)) return null;
    const koTitle = cleanNewsTitleForDisplay(item, koTr.title);
    return titlesDiffer(koTitle, displayed.title) ? koTitle : null;
  }
  return null;
}

export function displayNews(item, translations, locale) {
  const tr = translations.find((t) => t.newsItemId === item.id && t.locale === locale);
  const completed = hasUsableTranslation(tr, item);
  const titleOriginal = cleanNewsTitleForDisplay(item, item.titleOriginal);
  return {
    id: item.id,
    category: item.category,
    title: completed ? cleanNewsTitleForDisplay(item, tr.title) : titleOriginal,
    summary: completed ? cleanTranslationText(tr.summary) : item.summaryOriginal,
    displayLocale: completed ? locale : 'en',
    translationStatus: completed ? tr.status : 'missing',
    originalTitle: titleOriginal,
    originalSummary: item.summaryOriginal,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    imageUrl: item.imageUrl,
    symbols: item.symbols,
    hashtags: sortedHashtagsForPublic(item),
    provider: item.provider,
    publishedAt: item.publishedAt,
    fetchedAt: item.fetchedAt,
  };
}

export function filterNews(items, url) {
  const category = url.searchParams.get('category');
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const symbols = url.searchParams.get('symbols');
  const sources = url.searchParams.get('sources') || url.searchParams.get('source');
  const flash = ['1', 'true', 'yes'].includes(String(url.searchParams.get('flash') || '').trim().toLowerCase());
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const tag = url.searchParams.get('tag')?.trim().toLowerCase();
  let rows = [...items];
  if (category) {
    if (category === 'all') {
      rows = rows.filter(
        (item) =>
          ['global', 'korea', 'crypto', 'it'].includes(String(item.category || '')) ||
          String(item.provider || '') === 'financialjuice',
      );
    } else if (category === 'global') {
      rows = rows.filter(
        (item) => item.category === 'global' || String(item.provider || '') === 'financialjuice',
      );
    } else {
      rows = rows.filter((item) => item.category === category);
    }
  }
  const symbolSet = new Set([
    ...(symbol ? [symbol] : []),
    ...(symbols
      ? symbols
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : []),
  ]);
  if (symbolSet.size > 0) rows = rows.filter((item) => item.symbols?.some((s) => symbolSet.has(String(s).toUpperCase())));
  if (sources) {
    const sourceSet = new Set(
      sources
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (sourceSet.size > 0) rows = rows.filter((item) => sourceSet.has(String(item.sourceName || '').trim()));
  }
  if (flash) rows = rows.filter((item) => isFlashNewsItem(item));
  if (from) rows = rows.filter((item) => isAtOrAfter(item.publishedAt, from));
  if (to) rows = rows.filter((item) => isAtOrBefore(item.publishedAt, to));
  if (tag) {
    rows = rows.filter((item) =>
      hashtagLabelsForFilter(item).some((label) => label.toLowerCase() === tag),
    );
  }
  if (q) {
    rows = rows.filter((item) =>
      [item.titleOriginal, item.summaryOriginal, item.sourceName, ...hashtagLabelsForFilter(item)].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

const FLASH_KEYWORD_RE =
  /breaking|flash|속보|긴급|urgent|live\s*:|market\s*alert|just\s*in|developing|exclusive:/i;
const FLASH_MAX_AGE_MS = 18 * 60 * 1000;

export function isFlashNewsItem(item, nowMs = Date.now()) {
  const blob = [
    item?.titleOriginal,
    item?.summaryOriginal,
    item?.originalTitle,
    item?.originalSummary,
    item?.title,
    item?.summary,
    item?.category,
  ].join(' ');
  if (FLASH_KEYWORD_RE.test(blob)) return true;
  const cat = String(item?.category || '').toLowerCase();
  if (cat.includes('breaking') || cat.includes('flash') || cat.includes('hot')) return true;
  const publishedMs = item?.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  const ageMs = nowMs - publishedMs;
  return ageMs >= 0 && ageMs <= FLASH_MAX_AGE_MS;
}

export function filterCalendar(items, url) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const type = url.searchParams.get('type');
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (from) rows = rows.filter((item) => !item.date || item.date >= from);
  if (to) rows = rows.filter((item) => !item.date || item.date <= to);
  if (type) rows = rows.filter((item) => item.type === type);
  if (symbol) {
    rows = rows.filter((item) => {
      const sym = String(item.symbol || '').toUpperCase();
      const hay = `${item.title || ''} ${item.country || ''}`.toUpperCase();
      return sym === symbol || hay.includes(symbol);
    });
  }
  if (q) {
    rows = rows.filter((item) =>
      [item.title, item.country, item.symbol, item.type].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.title.localeCompare(b.title));
}

export function filterYoutube(items, url) {
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const channel = url.searchParams.get('channel')?.trim().toLowerCase();
  const channelHandles = String(url.searchParams.get('channelHandles') || '')
    .split(',')
    .map((handle) => handle.trim().toLowerCase())
    .filter(Boolean);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  let rows = [...items];
  if (channelHandles.length > 0) {
    rows = rows.filter((item) => itemMatchesYoutubeChannelHandles(item, channelHandles));
  }
  if (channel) rows = rows.filter((item) => String(item.channel || '').toLowerCase().includes(channel));
  if (q) {
    rows = rows.filter((item) =>
      [item.title, item.description, item.channel].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  const bucketRows = rows.filter((item) => item.sortBucket === sort || item.sortBuckets?.includes(sort));
  if (bucketRows.length > 0) rows = bucketRows;
  if (sort === 'popular') {
    return rows.sort(
      (a, b) =>
        (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0) ||
        new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime(),
    );
  }
  return rows.sort(
    (a, b) =>
      new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime() ||
      (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0),
  );
}

export function filterMarketQuotes(items, url) {
  const segment = url.searchParams.get('segment');
  const symbols = url.searchParams.get('symbols');
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (segment) rows = rows.filter((item) => item.segment === segment);
  if (symbols) {
    const set = new Set(
      symbols
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    rows = rows.filter((item) =>
      [
        item.symbol,
        item.displaySymbol,
        item.krxSymbol,
        item.providerItemId,
        item.rawPayload?.krxSymbol,
        item.rawPayload?.displaySymbol,
        item.regularSession?.yahooSymbol,
      ].some((value) => set.has(String(value || '').trim().toUpperCase())),
    );
  }
  if (q) {
    rows = rows.filter((item) =>
      [item.symbol, item.name, item.segment].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  // If the request is "by symbols" without a segment, return a single best row per symbol.
  // (Otherwise duplicates can occur when the same symbol exists in multiple segments.)
  if (symbols && !segment) {
    const bestBySymbol = new Map();
    for (const row of rows) {
      const key = String(row.krxSymbol || row.rawPayload?.krxSymbol || row.symbol || '').trim().toUpperCase();
      if (!key) continue;
      const prev = bestBySymbol.get(key);
      const prevAt = prev?.fetchedAt ? new Date(prev.fetchedAt).getTime() : 0;
      const nextAt = row?.fetchedAt ? new Date(row.fetchedAt).getTime() : 0;
      if (!prev || nextAt >= prevAt) bestBySymbol.set(key, row);
    }
    rows = [...bestBySymbol.values()];
  }
  return rows.sort(
    (a, b) =>
      String(a.segment || '').localeCompare(String(b.segment || '')) ||
      String(a.symbol || '').localeCompare(String(b.symbol || '')),
  );
}

export function filterCoinMarkets(items, url) {
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (q) {
    rows = rows.filter((item) =>
      [item.symbol, item.name, item.providerItemId].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
}

export function getMarketList(db, key) {
  return (db.marketLists || []).find((item) => item.key === key);
}
