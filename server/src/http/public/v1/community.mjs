import { queryPublicCommunityRows, COMMUNITY_SOURCES } from '../../../db/repositories/communityRepository.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicCommunityRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/community/sources') {
    json(res, 200, { data: COMMUNITY_SOURCES });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/community') {
    const page = await queryPublicCommunityRows({
      source: url.searchParams.get('source') || '',
      q: url.searchParams.get('q') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
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
