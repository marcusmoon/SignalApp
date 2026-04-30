import { readDb } from '../../../db.mjs';
import { filterConcalls, json, paginate } from '../../shared.mjs';

export async function handlePublicConcallsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/concalls') {
    const db = await readDb();
    const page = paginate(filterConcalls(db.concallTranscripts, url), url, 30, 100);
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
