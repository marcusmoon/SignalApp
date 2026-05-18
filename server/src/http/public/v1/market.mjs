import {
  queryPublicCoinMarkets,
  queryPublicMarketQuotes,
  readAppSettings,
  readPublicMarketList,
  readPublicMarketLists,
  upsertMarketQuotes,
} from '../../../db.mjs';
import { publicMarketList } from '../../../marketLists.mjs';
import { fetchMarketQuotes, fetchStockCandles, fetchStockProfile } from '../../../providers/market/index.mjs';
import { json } from '../../shared.mjs';

function publicStockProfile(data, fallbackSymbol) {
  const symbol = String(data?.ticker || data?.symbol || fallbackSymbol || '').trim().toUpperCase();
  return {
    symbol,
    name: data?.name || undefined,
    marketCapitalization: Number.isFinite(Number(data?.marketCapitalization))
      ? Number(data.marketCapitalization)
      : undefined,
  };
}

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
      json(res, 200, { data: publicStockProfile(data, symbol) });
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
    // Explicit refresh is intentionally opt-in. The watchlist calls this endpoint
    // often, so automatic provider refresh would make the tab latency scale with
    // the number of watch symbols.
    const symbolsParam = url.searchParams.get('symbols');
    const shouldRefreshProvider = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
    if (symbolsParam && shouldRefreshProvider) {
      const requested = [...new Set(symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
      if (requested.length > 0) {
        const existingPage = await queryPublicMarketQuotes({
          segment: url.searchParams.get('segment') || '',
          symbols: symbolsParam,
          q: url.searchParams.get('q') || '',
          limit: String(Math.max(100, requested.length)),
          offset: '0',
        });
        const existing = existingPage.rows || [];
        const have = new Set(existing.map((r) => String(r.symbol || '').trim().toUpperCase()).filter(Boolean));
        const missing = requested.filter((sym) => !have.has(sym));
        const appSettings = await readAppSettings();
        const maxAgeSec = Math.max(0, Number(appSettings?.marketQuotesMaxAgeSec ?? 10) || 10);
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
              await upsertMarketQuotes(fetched);
            }
          } catch {
            // If the upstream provider is unavailable, keep the response DB-only.
          }
        }
      }
    }

    const page = await queryPublicMarketQuotes({
      segment: url.searchParams.get('segment') || '',
      symbols: url.searchParams.get('symbols') || '',
      q: url.searchParams.get('q') || '',
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

  if (req.method === 'GET' && pathname === '/v1/coins') {
    const page = await queryPublicCoinMarkets({
      q: url.searchParams.get('q') || '',
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

  if (req.method === 'GET' && pathname === '/v1/market-lists') {
    const lists = await readPublicMarketLists();
    json(res, 200, { data: lists.map(publicMarketList) });
    return true;
  }

  const publicMarketListMatch = pathname.match(/^\/v1\/market-lists\/([^/]+)$/);
  if (req.method === 'GET' && publicMarketListMatch) {
    const key = decodeURIComponent(publicMarketListMatch[1]);
    const list = await readPublicMarketList(key);
    if (!list) {
      json(res, 404, { error: 'MARKET_LIST_NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: publicMarketList(list) });
    return true;
  }

  return false;
}
