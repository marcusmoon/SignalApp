import { queryPublicYoutube } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicYoutubeRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/youtube') {
    const page = await queryPublicYoutube({
      q: url.searchParams.get('q') || '',
      channel: url.searchParams.get('channel') || '',
      sort: url.searchParams.get('sort') || 'latest',
      limit: url.searchParams.get('limit') || url.searchParams.get('pageSize') || '30',
      offset: url.searchParams.get('offset') || '',
      page: url.searchParams.get('page') || '',
    });
    json(res, 200, {
      data: page.rows,
      meta: {
        limit: page.limit,
        offset: page.offset,
        total: page.total,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      },
    });
    return true;
  }
  return false;
}
