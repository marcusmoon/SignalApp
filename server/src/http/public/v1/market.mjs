import {
  queryPublicCoinMarkets,
  queryPublicMarketQuotes,
  queryPublicPriceSeriesCandles,
  readPublicMarketList,
  readPublicMarketLists,
} from '../../../db.mjs';
import { publicMarketList } from '../../../marketLists.mjs';
import { fetchYahooKrxDailyCandles } from '../../../providers/market/yahooDailyBars.mjs';
import { fetchStockCandles, fetchStockProfile } from '../../../providers/market/index.mjs';
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

function isKrxSymbol(symbol) {
  return /^\d{6}$/.test(String(symbol || '').trim());
}

async function localKrxMarketQuote(symbol) {
  const quotePage = await queryPublicMarketQuotes({ symbols: symbol, limit: '1', offset: '0' });
  return Array.isArray(quotePage?.rows) ? quotePage.rows[0] || null : null;
}

async function localKrxStockProfile(symbol) {
  const quote = await localKrxMarketQuote(symbol);
  if (!quote) return null;
  return publicStockProfile(
    {
      symbol,
      name: quote?.name || quote?.displaySymbol || symbol,
      marketCapitalization: quote?.marketCapitalization,
    },
    symbol,
  );
}

function preferredYahooFromQuote(quote) {
  return String(quote?.regularSession?.yahooSymbol || quote?.yahooSymbol || '').trim().toUpperCase() || null;
}

export async function handlePublicMarketRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/stock-profile') {
    const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
    if (!symbol) {
      json(res, 400, { error: 'SYMBOL_REQUIRED' });
      return true;
    }
    try {
      if (isKrxSymbol(symbol)) {
        const localProfile = await localKrxStockProfile(symbol);
        if (localProfile?.name) {
          json(res, 200, { data: localProfile });
          return true;
        }
      }
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
      const fromSec = Math.floor(from);
      const toSec = Math.floor(to);
      if (resolution === 'D') {
        const localCandles = await queryPublicPriceSeriesCandles({
          symbol,
          from: fromSec,
          to: toSec,
        });
        if (localCandles?.s === 'ok') {
          json(res, 200, { data: localCandles });
          return true;
        }
        // KRX: Finnhub candle는 6자리 코드를 못 주므로 Yahoo로 live 폴백
        if (isKrxSymbol(symbol)) {
          const quote = await localKrxMarketQuote(symbol);
          const yahooCandles = await fetchYahooKrxDailyCandles(symbol, {
            from: fromSec,
            to: toSec,
            preferredYahooSymbol: preferredYahooFromQuote(quote),
            range: '3mo',
          });
          if (yahooCandles?.s === 'ok') {
            json(res, 200, { data: yahooCandles });
            return true;
          }
          json(res, 502, { error: 'CANDLES_UNAVAILABLE' });
          return true;
        }
      }
      const data = await fetchStockCandles(symbol, {
        resolution,
        from: fromSec,
        to: toSec,
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
    // DB-only. Provider ingest is Job-driven (Finnhub US / Yahoo KRX). Do not
    // fetch upstream on read — watchlist latency must not scale with symbol count.
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
