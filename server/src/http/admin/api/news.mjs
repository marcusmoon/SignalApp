import { nowIso, readDb, updateDb, upsertById } from '../../../db.mjs';
import { retranslateNewsItems } from '../../../jobs/runner.mjs';
import {
  cleanNewsTitleForDisplay,
  cleanTranslationText,
  displayNews,
  filterNews,
  hasUsableTranslation,
  json,
  paginate,
  readBody,
} from '../../shared.mjs';

export async function handleAdminNewsRoutes({ req, res, url, pathname, adminId }) {
  if (req.method === 'GET' && pathname === '/admin/api/news') {
    const db = await readDb();
    const locale = url.searchParams.get('locale') || 'ko';
    const translationStatus = url.searchParams.get('translationStatus');
    let filtered = filterNews(db.newsItems, url).map((item) => ({
      ...displayNews(item, db.newsTranslations, locale),
      translations: db.newsTranslations
        .filter((t) => t.newsItemId === item.id)
        .map((t) => ({
          ...t,
          title: cleanNewsTitleForDisplay(item, t.title),
          summary: cleanTranslationText(t.summary),
          content: cleanTranslationText(t.content),
          status: hasUsableTranslation(t, item) ? t.status : 'missing',
        })),
    }));
    if (translationStatus) {
      filtered = filtered.filter((item) => item.translationStatus === translationStatus);
    }
    const page = paginate(filtered, url, 30, 100);
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
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
