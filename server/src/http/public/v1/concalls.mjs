import { queryPublicConcalls } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicConcallsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/concalls') {
    const page = await queryPublicConcalls({
      symbol: url.searchParams.get('symbol') || '',
      year: url.searchParams.get('year') || url.searchParams.get('fiscalYear') || '',
      quarter: url.searchParams.get('quarter') || url.searchParams.get('fiscalQuarter') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      q: url.searchParams.get('q') || '',
      includeTranscript: url.searchParams.get('includeTranscript') === '1',
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '30',
    });
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }
  return false;
}
