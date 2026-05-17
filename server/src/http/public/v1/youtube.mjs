import { queryPublicYoutube, queryPublicYoutubeChannels } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicYoutubeRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/youtube-channels') {
    const channels = await queryPublicYoutubeChannels();
    json(res, 200, { data: channels });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/youtube') {
    const page = await queryPublicYoutube({
      q: url.searchParams.get('q') || '',
      channel: url.searchParams.get('channel') || '',
      channelHandles: url.searchParams.get('channelHandles') || url.searchParams.get('handles') || '',
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
