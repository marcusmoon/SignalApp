import { listLegalTerms, updateLegalTerm } from '../../../db.mjs';
import { json, readBody } from '../../shared.mjs';

export async function handleAdminLegalTermsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/legal-terms') {
    const locale = url.searchParams.get('locale') || '';
    json(res, 200, { data: await listLegalTerms({ locale, activeOnly: false }) });
    return true;
  }

  const match = pathname.match(/^\/admin\/api\/legal-terms\/([^/]+)\/([^/]+)$/);
  if (req.method === 'PATCH' && match) {
    try {
      const type = decodeURIComponent(match[1]);
      const locale = decodeURIComponent(match[2]);
      const body = await readBody(req);
      const updated = await updateLegalTerm(type, locale, body);
      json(res, 200, { data: updated });
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      json(res, code.startsWith('LEGAL_TERM_') ? 400 : 500, { error: code });
    }
    return true;
  }

  return false;
}
