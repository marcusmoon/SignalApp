import { fetchPublicDisclosuresByIds } from '../db/repositories/disclosuresRepository.mjs';
import { fetchPublicNewsByIds } from '../db/repositories/newsRepository.mjs';
import { cleanText } from '../db/repositories/publicHelpers.mjs';

function refId(ref) {
  return cleanText(ref?.id || ref?.newsId);
}

function refType(ref) {
  return cleanText(ref?.type).toLowerCase();
}

function isDisclosureRef(ref) {
  const type = refType(ref);
  return type === 'disclosure' || type === 'filing';
}

function embeddedNewsRef(ref) {
  return {
    type: cleanText(ref?.type) || 'news',
    id: refId(ref) || null,
    newsId: refId(ref) || null,
    title: cleanText(ref?.title) || null,
    url: cleanText(ref?.url) || null,
    sourceName: cleanText(ref?.sourceName) || null,
    publishedAt: ref?.publishedAt || null,
  };
}

function embeddedDisclosureRef(ref) {
  return {
    type: 'disclosure',
    id: refId(ref) || null,
    title: cleanText(ref?.title) || null,
    url: cleanText(ref?.url) || null,
    companyName: cleanText(ref?.companyName) || null,
    symbol: cleanText(ref?.symbol) || null,
    formType: cleanText(ref?.formType) || null,
    filedAt: ref?.filedAt || null,
  };
}

function hydratedNewsRef(ref, news) {
  return {
    type: 'news',
    id: news.id,
    newsId: news.id,
    title: news.title,
    url: news.sourceUrl || null,
    sourceName: news.sourceName || null,
    publishedAt: news.publishedAt || null,
    resolved: true,
  };
}

function hydratedDisclosureRef(ref, disclosure) {
  return {
    type: 'disclosure',
    id: disclosure.id,
    title: disclosure.title,
    url: disclosure.url || null,
    companyName: disclosure.companyName || null,
    symbol: disclosure.symbol || null,
    formType: disclosure.formType || null,
    filedAt: disclosure.filedAt || null,
    resolved: true,
  };
}

/**
 * Read-time hydration: stored refs (id/type) → canonical news/disclosure rows.
 * v1 ingest snapshots without resolvable ids fall back to embedded title/url.
 */
export async function hydrateSourceRefs(sourceRefs, options = {}) {
  const locale = cleanText(options.locale) || 'ko';
  const refs = Array.isArray(sourceRefs) ? sourceRefs : [];
  if (refs.length === 0) return [];

  const newsIds = [];
  const disclosureIds = [];
  for (const ref of refs) {
    const id = refId(ref);
    if (!id) continue;
    if (isDisclosureRef(ref)) disclosureIds.push(id);
    else newsIds.push(id);
  }

  const [newsById, disclosureById] = await Promise.all([
    fetchPublicNewsByIds(newsIds, locale),
    fetchPublicDisclosuresByIds(disclosureIds),
  ]);

  return refs.map((ref) => {
    const id = refId(ref);
    if (!id) {
      return isDisclosureRef(ref) ? embeddedDisclosureRef(ref) : embeddedNewsRef(ref);
    }
    if (isDisclosureRef(ref)) {
      const disclosure = disclosureById.get(id);
      return disclosure ? hydratedDisclosureRef(ref, disclosure) : embeddedDisclosureRef(ref);
    }
    const news = newsById.get(id);
    return news ? hydratedNewsRef(ref, news) : embeddedNewsRef(ref);
  });
}

export function deriveNewsDigestSources(sourceRefs) {
  const names = [];
  const seen = new Set();
  for (const ref of sourceRefs) {
    const name = cleanText(ref?.sourceName);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export async function hydrateNewsDigestItem(item, options = {}) {
  if (!item || typeof item !== 'object') return item;
  const sourceRefs = await hydrateSourceRefs(item.sourceRefs, options);
  return {
    ...item,
    sourceRefs,
    sources: deriveNewsDigestSources(sourceRefs).length
      ? deriveNewsDigestSources(sourceRefs)
      : Array.isArray(item.sources)
        ? item.sources
        : [],
  };
}

export async function hydrateDisclosureDigestItem(item, options = {}) {
  if (!item || typeof item !== 'object') return item;
  const sourceRefs = await hydrateSourceRefs(item.sourceRefs, options);
  return { ...item, sourceRefs };
}

export async function hydrateNewsDigestItems(items, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  return Promise.all(rows.map((item) => hydrateNewsDigestItem(item, options)));
}

export async function hydrateDisclosureDigestItems(items, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  return Promise.all(rows.map((item) => hydrateDisclosureDigestItem(item, options)));
}

export async function hydrateMarketBriefingItem(item, options = {}) {
  if (!item || typeof item !== 'object') return item;
  const sourceRefs = await hydrateSourceRefs(item.sourceRefs, options);
  return { ...item, sourceRefs };
}

export async function hydrateTodayBriefingItem(item, options = {}) {
  if (!item || typeof item !== 'object') return item;
  const sourceRefs = await hydrateSourceRefs(item.sourceRefs, options);
  return { ...item, sourceRefs };
}

export async function hydrateMarketBriefingItems(items, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  return Promise.all(rows.map((item) => hydrateMarketBriefingItem(item, options)));
}

export async function hydrateTodayBriefingItems(items, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  return Promise.all(rows.map((item) => hydrateTodayBriefingItem(item, options)));
}
