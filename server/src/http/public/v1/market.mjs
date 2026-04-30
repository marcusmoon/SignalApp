import { readDb, updateDb, upsertById } from '../../../db.mjs';
import { publicMarketList } from '../../../marketLists.mjs';
import { fetchMarketQuotes, fetchStockCandles, fetchStockProfile } from '../../../providers/market/index.mjs';
import {
  filterCoinMarkets,
  filterMarketQuotes,
  getMarketList,
  json,
  paginate,
} from '../../shared.mjs';

export async function handlePublicMarketRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/stock-profile') {
    const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
    if (!symbol) {
      json(res, 400, { error: 'SYMBOL_REQUIRED' });
      return true;
    }
    try {
      const data = await fetchStockProfile(symbol);
      if (!data || typeof data !== 'object') {
        json(res, 404, { error: 'PROFILE_NOT_FOUND' });
        return true;
      }
      const hasId = String(data.ticker || data.symbol || data.name || '').trim();
      if (!hasId) {
        json(res, 404, { error: 'PROFILE_NOT_FOUND' });
        return true;
      }
      json(res, 200, { data });
    } catch {
      json(res, 502, { error: 'PROFILE_UNAVAILABLE' });
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/stock-candles') {
    const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
    const resolution = url.searchParams.get('resolution') || 'D';
    const from = Number(url.searchParams.get('from'));
    const to = Number(url.searchParams.get('to'));
    if (!symbol || !Number.isFinite(from) || !Number.isFinite(to)) {
      json(res, 400, { error: 'BAD_QUERY' });
      return true;
    }
    try {
      const data = await fetchStockCandles(symbol, {
        resolution,
        from: Math.floor(from),
        to: Math.floor(to),
      });
      if (!data) {
        json(res, 502, { error: 'CANDLES_UNAVAILABLE' });
        return true;
      }
      json(res, 200, { data });
    } catch {
      json(res, 502, { error: 'CANDLES_UNAVAILABLE' });
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/market-quotes') {
    const db = await readDb();

    // If requested by explicit symbols, and some quotes are missing/stale in DB,
    // fetch them on-demand from the active market provider and persist them.
    const symbolsParam = url.searchParams.get('symbols');
    if (symbolsParam) {
      const requested = [...new Set(symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
      if (requested.length > 0) {
        const existing = filterMarketQuotes(db.marketQuotes, url);
        const have = new Set(existing.map((r) => String(r.symbol || '').trim().toUpperCase()).filter(Boolean));
        const missing = requested.filter((sym) => !have.has(sym));
        const maxAgeSec = Math.max(0, Number(db.appSettings?.marketQuotesMaxAgeSec ?? 10) || 10);
        const stale = [];
        if (maxAgeSec > 0) {
          const staleBefore = Date.now() - maxAgeSec * 1000;
          const bySymbol = new Map(
            existing
              .map((r) => [String(r.symbol || '').trim().toUpperCase(), r])
              .filter(([sym]) => sym),
          );
          for (const sym of requested) {
            const row = bySymbol.get(sym);
            if (!row?.fetchedAt) continue;
            const t = new Date(row.fetchedAt).getTime();
            if (!Number.isFinite(t) || t < staleBefore) stale.push(sym);
          }
        }

        const needFetch = [...new Set([...missing, ...stale])];
        if (needFetch.length > 0) {
          try {
            const seg = url.searchParams.get('segment') || 'watch';
            const fetched = await fetchMarketQuotes({ symbols: needFetch, segment: seg });
            if (fetched.length > 0) {
              await updateDb((next) => {
                for (const row of fetched) upsertById(next.marketQuotes, row);
              });
              // Mutate local snapshot too, so the response includes the fetched rows.
              for (const row of fetched) upsertById(db.marketQuotes, row);
            }
          } catch {
            // If the upstream provider is unavailable, keep the response DB-only.
          }
        }
      }
    }

    const page = paginate(filterMarketQuotes(db.marketQuotes, url), url, 30, 100);
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/coins') {
    const db = await readDb();
    const page = paginate(filterCoinMarkets(db.coinMarkets, url), url, 30, 100);
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/market-lists') {
    const db = await readDb();
    json(res, 200, { data: (db.marketLists || []).map(publicMarketList) });
    return true;
  }

  const publicMarketListMatch = pathname.match(/^\/v1\/market-lists\/([^/]+)$/);
  if (req.method === 'GET' && publicMarketListMatch) {
    const db = await readDb();
    const key = decodeURIComponent(publicMarketListMatch[1]);
    const list = getMarketList(db, key);
    if (!list) {
      json(res, 404, { error: 'MARKET_LIST_NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: publicMarketList(list) });
    return true;
  }

  return false;
}
