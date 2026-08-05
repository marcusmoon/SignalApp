import {
  deleteSymbolProfileByKey,
  getSymbolProfileByKey,
  listSymbolProfiles,
  saveSymbolProfileAdmin,
} from '../../../db/repositories/symbolProfilesRepository.mjs';
import { clearPublicApiReadCache } from '../../../db.mjs';
import { json, readBody } from '../../shared.mjs';

function profileErrorStatus(error) {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code === 'SYMBOL_PROFILE_NOT_FOUND') return 404;
  if (code.startsWith('SYMBOL_PROFILE_')) return 400;
  return 500;
}

export async function handleAdminSymbolProfilesRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/symbol-profiles') {
    const q = url.searchParams.get('q') || '';
    const market = url.searchParams.get('market') || '';
    const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize')) || 50, 1), 200);
    const data = await listSymbolProfiles({
      q,
      market,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    json(res, 200, { data });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/symbol-profiles') {
    try {
      const body = await readBody(req);
      const saved = await saveSymbolProfileAdmin(body || {});
      clearPublicApiReadCache();
      json(res, 200, { data: saved });
    } catch (error) {
      json(res, profileErrorStatus(error), { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const match = pathname.match(/^\/admin\/api\/symbol-profiles\/([^/]+)$/);
  if (!match) return false;
  const symbolKey = decodeURIComponent(match[1]);

  if (req.method === 'GET') {
    const row = await getSymbolProfileByKey(symbolKey);
    if (!row) {
      json(res, 404, { error: 'SYMBOL_PROFILE_NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: row });
    return true;
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = await readBody(req);
      const existing = await getSymbolProfileByKey(symbolKey);
      if (!existing) {
        json(res, 404, { error: 'SYMBOL_PROFILE_NOT_FOUND' });
        return true;
      }
      const saved = await saveSymbolProfileAdmin({
        market: body?.market ?? existing.market,
        symbol: body?.symbol ?? existing.symbol,
        displaySymbol: body?.displaySymbol ?? existing.displaySymbol,
        name: body?.name !== undefined ? body.name : existing.name,
        exchange: body?.exchange !== undefined ? body.exchange : existing.exchange,
        logoUrl: body?.logoUrl !== undefined ? body.logoUrl : existing.logoUrl,
        source: 'admin',
      });
      clearPublicApiReadCache();
      json(res, 200, { data: saved });
    } catch (error) {
      json(res, profileErrorStatus(error), { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (req.method === 'DELETE') {
    try {
      const data = await deleteSymbolProfileByKey(symbolKey);
      clearPublicApiReadCache();
      json(res, 200, { data });
    } catch (error) {
      json(res, profileErrorStatus(error), { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  return false;
}
