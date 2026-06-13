import {
  queryPublicNews,
  queryPublicNewsDigests,
  queryPublicNewsSources,
} from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicNewsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/news-digests') {
    const page = await queryPublicNewsDigests({
      category: url.searchParams.get('category') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      limit: url.searchParams.get('limit') || '4',
      offset: url.searchParams.get('offset') || '0',
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

  if (req.method === 'GET' && pathname === '/v1/news') {
    const page = await queryPublicNews({
      locale: url.searchParams.get('locale') || 'ko',
      category: url.searchParams.get('category') || '',
      symbol: url.searchParams.get('symbol') || '',
      symbols: url.searchParams.get('symbols') || '',
      source: url.searchParams.get('source') || '',
      sources: url.searchParams.get('sources') || '',
      flash: url.searchParams.get('flash') || '',
      q: url.searchParams.get('q') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      tag: url.searchParams.get('tag') || '',
      timeZone: url.searchParams.get('timeZone') || '',
      limit: url.searchParams.get('limit') || '20',
      offset: url.searchParams.get('offset') || '0',
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

  if (req.method === 'GET' && pathname === '/v1/news-sources') {
    const category = url.searchParams.get('category');
    const sources = await queryPublicNewsSources({ category });
    json(res, 200, { data: sources });
    return true;
  }

  return false;
}
