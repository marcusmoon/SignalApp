import { queryPublicDisclosureById, queryPublicDisclosures } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicDisclosureRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/disclosures') {
    const page = await queryPublicDisclosures({
      market: url.searchParams.get('market') || '',
      provider: url.searchParams.get('provider') || '',
      formType: url.searchParams.get('formType') || '',
      symbol: url.searchParams.get('symbol') || '',
      symbols: url.searchParams.get('symbols') || '',
      q: url.searchParams.get('q') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      limit: url.searchParams.get('limit') || '30',
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

  const detailMatch = /^\/v1\/disclosures\/([^/]+)$/.exec(pathname);
  if (req.method === 'GET' && detailMatch) {
    const item = await queryPublicDisclosureById(decodeURIComponent(detailMatch[1]));
    if (!item) {
      json(res, 404, { error: 'DISCLOSURE_NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: item });
    return true;
  }

  return false;
}
