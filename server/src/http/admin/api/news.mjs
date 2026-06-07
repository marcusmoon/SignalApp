import { hashtagRecordsFromLabels } from '../../../newsHashtags.mjs';
import { nowIso, queryAdminNews, readDb, updateDb, upsertById } from '../../../db.mjs';
import { retranslateNewsItems } from '../../../jobs/runner.mjs';
import {
  json,
  readBody,
} from '../../shared.mjs';

export async function handleAdminNewsRoutes({ req, res, url, pathname, adminId }) {
  if (req.method === 'GET' && pathname === '/admin/api/news') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const locale = url.searchParams.get('locale') || 'ko';
    const result = await queryAdminNews({
      locale,
      translationStatus: url.searchParams.get('translationStatus') || '',
      category: url.searchParams.get('category') || '',
      symbol: url.searchParams.get('symbol') || '',
      symbols: url.searchParams.get('symbols') || '',
      sources: url.searchParams.get('sources') || url.searchParams.get('source') || '',
      flash: url.searchParams.get('flash') || '',
      q: url.searchParams.get('q') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      tag: url.searchParams.get('tag') || '',
      limit: String(pageSize),
      offset: String((page - 1) * pageSize),
    });
    json(res, 200, {
      data: result.rows,
      page,
      pageSize,
      total: result.total,
      totalPages: result.hasMore ? page + 1 : page,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/news/retranslate') {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const locale = body.locale || 'ko';
    const result = await retranslateNewsItems({
      ids,
      locale,
      provider: body.provider,
      model: body.model,
      adminId,
    });
    json(res, 200, { data: result });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/news/delete') {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const result = await updateDb((db) => {
      const idSet = new Set(ids);
      const beforeNews = db.newsItems.length;
      const beforeTranslations = db.newsTranslations.length;
      db.newsItems = db.newsItems.filter((item) => !idSet.has(item.id));
      db.newsTranslations = db.newsTranslations.filter((item) => !idSet.has(item.newsItemId));
      return {
        newsDeleted: beforeNews - db.newsItems.length,
        translationsDeleted: beforeTranslations - db.newsTranslations.length,
      };
    });
    json(res, 200, { data: result });
    return true;
  }

  const hashtagMatch = pathname.match(/^\/admin\/api\/news\/([^/]+)\/hashtags$/);
  if (req.method === 'PATCH' && hashtagMatch) {
    const newsItemId = decodeURIComponent(hashtagMatch[1]);
    const body = await readBody(req);
    const locale = url.searchParams.get('locale') || 'ko';
    const dbBefore = await readDb();
    const exists = dbBefore.newsItems.some((n) => n.id === newsItemId);
    if (!exists) {
      json(res, 404, { error: 'NEWS_ITEM_NOT_FOUND' });
      return true;
    }
    const updated = await updateDb((db) => {
      const item = db.newsItems.find((n) => n.id === newsItemId);
      const explicitHashtags =
        Object.prototype.hasOwnProperty.call(body, 'hashtags') || Object.prototype.hasOwnProperty.call(body, 'labels');
      const unlockAuto = String(body.hashtagSource || '').toLowerCase() === 'auto' && !explicitHashtags;
      if (unlockAuto) {
        item.hashtagSource = 'auto';
        item.hashtagsUpdatedAt = nowIso();
        return displayNews(item, db.newsTranslations, locale);
      }
      let records;
      if (Array.isArray(body.hashtags) && body.hashtags.length && typeof body.hashtags[0] === 'object') {
        records = body.hashtags
          .map((t, i) => ({
            label: String(t.label || '').trim(),
            order: Number.isFinite(Number(t.order)) ? Number(t.order) : i,
            source: String(t.source || '').toLowerCase() === 'auto' ? 'auto' : 'manual',
          }))
          .filter((t) => t.label);
      } else {
        records = hashtagRecordsFromLabels(body.hashtags || body.labels || [], 'manual');
      }
      item.hashtags = records;
      item.hashtagSource = 'manual';
      item.hashtagsUpdatedAt = nowIso();
      return displayNews(item, db.newsTranslations, locale);
    });
    json(res, 200, { data: updated });
    return true;
  }

  const translationMatch = pathname.match(/^\/admin\/api\/news\/([^/]+)\/translation\/([^/]+)$/);
  if (req.method === 'PATCH' && translationMatch) {
    const newsItemId = decodeURIComponent(translationMatch[1]);
    const locale = decodeURIComponent(translationMatch[2]);
    const body = await readBody(req);
    const updated = await updateDb((db) =>
      upsertById(db.newsTranslations, {
        id: `${newsItemId}:${locale}`,
        newsItemId,
        locale,
        title: String(body.title || ''),
        summary: String(body.summary || ''),
        content: String(body.content || ''),
        provider: 'manual',
        model: 'admin-edit',
        status: 'manual',
        errorMessage: null,
        translatedAt: nowIso(),
        editedByAdminId: adminId,
        editedAt: nowIso(),
      }),
    );
    json(res, 200, { data: updated });
    return true;
  }

  return false;
}
