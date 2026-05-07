import { listLegalTerms } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicLegalRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/legal/terms') {
    const locale = url.searchParams.get('locale') || 'ko';
    const rows = await listLegalTerms({ locale, activeOnly: true });
    json(res, 200, { data: rows });
    return true;
  }
  return false;
}
