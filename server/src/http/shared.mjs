import { hashtagLabelsForFilter, sortedHashtagsForPublic } from '../newsHashtags.mjs';
import { stripFinancialJuiceTitlePrefix } from '../providers/news/financialJuiceRss.mjs';

export function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
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

export function dateKeyInTimeZone(value, timeZone) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || '').slice(0, 10);
  const tz = String(timeZone || '').trim();
  if (!tz) return date.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.year && byType.month && byType.day) return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    // Fall back to stored UTC date when an unknown timezone is supplied.
  }
  return date.toISOString().slice(0, 10);
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
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const tag = url.searchParams.get('tag')?.trim().toLowerCase();
  const timeZone = url.searchParams.get('timeZone');
  let rows = [...items];
  if (category) {
    if (category === 'global') {
      rows = rows.filter(
        (item) => item.category === 'global' || String(item.provider || '') === 'financialjuice',
      );
    } else {
      rows = rows.filter((item) => item.category === category);
    }
  }
  if (symbol) rows = rows.filter((item) => item.symbols?.includes(symbol));
  if (from) rows = rows.filter((item) => !item.publishedAt || dateKeyInTimeZone(item.publishedAt, timeZone) >= from);
  if (to) rows = rows.filter((item) => !item.publishedAt || dateKeyInTimeZone(item.publishedAt, timeZone) <= to);
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
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  let rows = [...items];
  if (channel) rows = rows.filter((item) => String(item.channel || '').toLowerCase().includes(channel));
  if (q) {
    rows = rows.filter((item) =>
      [item.title, item.description, item.channel].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  const bucketRows = rows.filter((item) => item.sortBucket === sort);
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
    rows = rows.filter((item) => set.has(String(item.symbol || '').toUpperCase()));
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
      const key = String(row.symbol || '').trim().toUpperCase();
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

export function filterConcalls(items, url) {
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const year = url.searchParams.get('year') || url.searchParams.get('fiscalYear');
  const quarter = url.searchParams.get('quarter') || url.searchParams.get('fiscalQuarter');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const includeTranscript = url.searchParams.get('includeTranscript') === '1';
  let rows = [...items];
  if (symbol) rows = rows.filter((item) => String(item.symbol || '').toUpperCase() === symbol);
  if (year) rows = rows.filter((item) => String(item.fiscalYear ?? '') === String(year));
  if (quarter) rows = rows.filter((item) => String(item.fiscalQuarter ?? '') === String(quarter));
  if (from) rows = rows.filter((item) => !item.earningsDate || item.earningsDate >= from);
  if (to) rows = rows.filter((item) => !item.earningsDate || item.earningsDate <= to);
  if (q) {
    rows = rows.filter((item) =>
      [item.symbol, item.title, item.summaryProvider, item.provider].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows
    .sort(
      (a, b) =>
        String(b.earningsDate || '').localeCompare(String(a.earningsDate || '')) ||
        String(a.symbol || '').localeCompare(String(b.symbol || '')),
    )
    .map((item) => {
      if (includeTranscript) return item;
      const { transcript, rawPayload, ...rest } = item;
      return rest;
    });
}

export function getMarketList(db, key) {
  return (db.marketLists || []).find((item) => item.key === key);
}
