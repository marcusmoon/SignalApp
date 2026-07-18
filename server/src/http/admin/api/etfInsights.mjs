import { deleteCollectionPayloads, patchCollectionPayload } from '../../../db.mjs';
import { queryPublicEtfInsights } from '../../../db/repositories/etfInsightsRepository.mjs';
import { json, readBody } from '../../shared.mjs';

export async function handleAdminEtfInsightRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/etf-insights') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
    const result = await queryPublicEtfInsights({
      period: url.searchParams.get('period') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      limit: String(pageSize + 1),
      offset: String((page - 1) * pageSize),
    });
    const data = result.rows.slice(0, pageSize);
    json(res, 200, {
      data,
      page,
      pageSize,
      total: (page - 1) * pageSize + data.length + (result.hasMore ? 1 : 0),
    });
    return true;
  }

  const byId = pathname.match(/^\/admin\/api\/etf-insights\/([^/]+)$/);

  if (req.method === 'GET' && byId) {
    const id = decodeURIComponent(byId[1]);
    const result = await queryPublicEtfInsights({ id, limit: 1 });
    const row = result.rows[0];
    if (!row) {
      json(res, 404, { error: 'NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: row });
    return true;
  }

  if ((req.method === 'PATCH' || req.method === 'PUT') && byId) {
    const id = decodeURIComponent(byId[1]);
    const body = await readBody(req);
    const updated = await patchCollectionPayload('etfInsights', id, body || {});
    json(res, 200, { ok: true, data: updated });
    return true;
  }

  if (req.method === 'DELETE' && byId) {
    const id = decodeURIComponent(byId[1]);
    const result = await deleteCollectionPayloads('etfInsights', [id]);
    json(res, 200, { ok: true, deleted: result.deleted });
    return true;
  }

  return false;
}
