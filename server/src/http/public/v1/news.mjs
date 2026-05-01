import {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
  readDb,
} from '../../../db.mjs';
import { displayNews, filterNews, json } from '../../shared.mjs';

export async function handlePublicNewsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/news') {
    const db = await readDb();
    const locale = url.searchParams.get('locale') || 'ko';
    const filtered = filterNews(db.newsItems, url);
    const total = filtered.length;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 20) || 20), 100);
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
    const slice = filtered.slice(offset, offset + limit);
    const rows = slice.map((item) => displayNews(item, db.newsTranslations, locale));
    const hasMore = offset + rows.length < total;
    json(res, 200, {
      data: rows,
      meta: {
        limit,
        offset,
        total,
        hasMore,
        nextOffset: hasMore ? offset + rows.length : null,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/news-sources') {
    const db = await readDb();
    ensureNewsSourcesFromItems(db);
    const category = url.searchParams.get('category');
    const cat = category ? String(category).trim().toLowerCase() : '';

    // Category filtering must reflect the actual ingested items.
    // Legacy data may have sources created under "global" before category was tracked.
    let allowedNames = null;
    if (cat) {
      const set = new Set();
      for (const item of db.newsItems || []) {
        const itemCat = String(item?.category || '').trim().toLowerCase() === 'crypto' ? 'crypto' : 'global';
        if (itemCat !== cat) continue;
        const name = normalizeNewsSourceNameWithAliases(item?.sourceName, itemCat, db.newsSourceSettings);
        if (name) set.add(normalizeNewsSourceName(name));
      }
      // Keep Financial Juice visible in global as it is treated as global in /v1/news.
      if (cat === 'global') set.add('Financial Juice');
      allowedNames = set;
    }

    const sources = [...(db.newsSources || [])]
      .map((s) => ({
        id: String(s.id || '').trim(),
        name: normalizeNewsSourceName(s.name),
        category: String(s.category || 'global'),
        hidden: s.hidden === true,
        enabled: s.enabled !== false,
        order: Number(s.order) || 0,
      }))
      .filter((s) => s.id && s.name)
      .filter((s) => (!cat ? true : s.category === cat))
      .filter((s) => (!allowedNames ? true : allowedNames.has(s.name)))
      .filter((s) => !s.hidden)
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    json(res, 200, { data: sources });
    return true;
  }

  return false;
}
