import {
  queryPublicCoinMarkets,
  queryPublicMarketQuotes,
  queryPublicWatchSignals,
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function quoteMovePercent(quote) {
  const direct = finiteNumber(quote?.changePercent);
  if (direct != null) return direct;
  const current = finiteNumber(quote?.currentPrice);
  const previous = finiteNumber(quote?.previousClose);
  if (current != null && previous != null && previous !== 0) {
    return ((current - previous) / previous) * 100;
  }
  return 0;
}

function quoteFreshnessScore(quote) {
  const t = Date.parse(String(quote?.quoteTime || quote?.fetchedAt || ''));
  if (!Number.isFinite(t)) return 45;
  const ageMin = Math.max(0, (Date.now() - t) / 60_000);
  if (ageMin <= 30) return 100;
  if (ageMin <= 6 * 60) return 72;
  if (ageMin <= 24 * 60) return 58;
  return 42;
}

function quantLevel(score) {
  if (score >= 75) return 'strong';
  if (score >= 62) return 'watch';
  if (score >= 45) return 'neutral';
  return 'weak';
}

function quantRisk(movePct, regularMovePct) {
  const maxMove = Math.max(Math.abs(movePct), Math.abs(regularMovePct));
  if (maxMove >= 8) return 'high';
  if (maxMove >= 4) return 'medium';
  return 'low';
}

function addCode(out, code) {
  if (!code || out.includes(code)) return;
  out.push(code);
}

function publicQuantSignal(quote) {
  const movePct = quoteMovePercent(quote);
  const regularMovePct = quote?.regularSession ? quoteMovePercent(quote.regularSession) : 0;
  const momentum = Math.round(clamp(50 + movePct * 5, 0, 100));
  const regularSession = quote?.regularSession
    ? Math.round(clamp(50 + regularMovePct * 3, 0, 100))
    : 50;
  const freshness = Math.round(quoteFreshnessScore(quote));
  const score = Math.round(momentum * 0.55 + regularSession * 0.25 + freshness * 0.2);
  const reasonCodes = [];
  if (movePct >= 3) addCode(reasonCodes, 'after_hours_up');
  if (movePct <= -3) addCode(reasonCodes, 'after_hours_down');
  if (regularMovePct >= 2) addCode(reasonCodes, 'regular_up');
  if (regularMovePct <= -2) addCode(reasonCodes, 'regular_down');
  if (quote?.afterHoursAvailable) addCode(reasonCodes, 'after_hours_source');
  if (freshness >= 90) addCode(reasonCodes, 'fresh_quote');
  if (freshness <= 50) addCode(reasonCodes, 'stale_quote');
  if (reasonCodes.length === 0) addCode(reasonCodes, 'price_stable');

  return {
    symbol: quote.symbol,
    displaySymbol: quote.displaySymbol || quote.symbol || null,
    krxSymbol: quote.krxSymbol || null,
    name: quote.name || null,
    score,
    level: quantLevel(score),
    risk: quantRisk(movePct, regularMovePct),
    factors: {
      momentum,
      regularSession,
      freshness,
    },
    reasonCodes,
    quote,
    updatedAt: quote.quoteTime || quote.fetchedAt || null,
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

  if (req.method === 'GET' && pathname === '/v1/watch-signals') {
    const symbols = url.searchParams.get('symbols') || '';
    if (!symbols.trim()) {
      json(res, 400, { error: 'SYMBOLS_REQUIRED' });
      return true;
    }
    const rows = await queryPublicWatchSignals({
      symbols,
      limit: url.searchParams.get('limit') || '12',
      date: url.searchParams.get('date') || '',
      from: url.searchParams.get('from') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/quant-signals') {
    const symbols = url.searchParams.get('symbols') || '';
    const requestedCount = symbols.split(',').map((s) => s.trim()).filter(Boolean).length;
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || requestedCount || 30));
    const page = await queryPublicMarketQuotes({
      segment: url.searchParams.get('segment') || '',
      symbols,
      q: url.searchParams.get('q') || '',
      limit: String(Math.max(limit, requestedCount, 30)),
      offset: '0',
    });
    const rows = (page.rows || [])
      .filter((quote) => finiteNumber(quote?.currentPrice) != null)
      .map(publicQuantSignal)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    json(res, 200, { data: rows });
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
        const quoteKeys = (row) =>
          [
            row.symbol,
            row.displaySymbol,
            row.krxSymbol,
            row.providerItemId,
            row.regularSession?.yahooSymbol,
          ]
            .map((value) => String(value || '').trim().toUpperCase())
            .filter(Boolean);
        const have = new Set(existing.flatMap(quoteKeys));
        const missing = requested.filter((sym) => !have.has(sym));
        const appSettings = await readAppSettings();
        const maxAgeSec = Math.max(0, Number(appSettings?.marketQuotesMaxAgeSec ?? 10) || 10);
        const stale = [];
        if (maxAgeSec > 0) {
          const staleBefore = Date.now() - maxAgeSec * 1000;
          const bySymbol = new Map();
          for (const row of existing) {
            for (const key of quoteKeys(row)) bySymbol.set(key, row);
          }
          for (const sym of requested) {
            const row = bySymbol.get(sym);
            if (!row?.fetchedAt) continue;
            const t = new Date(row.fetchedAt).getTime();
            if (!Number.isFinite(t) || t < staleBefore) stale.push(sym);
          }
        }

        const needFetch = [...new Set([...missing, ...stale])].filter((sym) => !/^\d{6}$/.test(sym));
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
