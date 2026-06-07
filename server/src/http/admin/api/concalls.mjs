import { queryPublicConcalls } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handleAdminConcallsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/concalls') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const result = await queryPublicConcalls({
      symbol: url.searchParams.get('symbol') || '',
      year: url.searchParams.get('year') || url.searchParams.get('fiscalYear') || '',
      quarter: url.searchParams.get('quarter') || url.searchParams.get('fiscalQuarter') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      q: url.searchParams.get('q') || '',
      includeTranscript: url.searchParams.get('includeTranscript') || '',
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
  return false;
}
