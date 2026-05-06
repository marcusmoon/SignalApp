import { queryPublicYoutube } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicYoutubeRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/youtube') {
    const page = await queryPublicYoutube({
      q: url.searchParams.get('q') || '',
      channel: url.searchParams.get('channel') || '',
      sort: url.searchParams.get('sort') || 'latest',
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
