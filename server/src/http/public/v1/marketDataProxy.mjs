/**
 * Market data proxy routes.
 *
 * GET /v1/market-data/quotes?symbols=005930.KS,000660.KS,...
 *   Proxies Yahoo Finance real-time quote requests from Claude automation tasks.
 *   Protected by x-signal-automation-token (same token as briefing ingest).
 *   Returns price, changePercent, previousClose for each requested symbol.
 *   Max 30 symbols per request. Symbols not found return null values.
 */

import { config } from '../../../config.mjs';
import { queryPublicMarketQuotes } from '../../../db.mjs';
import { fetchYahooQuotes } from '../../../providers/market/yahooQuote.mjs';
import { json } from '../../shared.mjs';

const MAX_SYMBOLS = 30;

function hasAutomationAccess(req) {
  const configured = String(config.automationIngestToken || '').trim();
  if (!configured) return false;
  const header = String(req.headers['x-signal-automation-token'] || '').trim();
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return header === configured || bearer === configured;
}

function cleanSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function quoteKeys(quote) {
  return [
    quote?.symbol,
    quote?.displaySymbol,
    quote?.krxSymbol,
    quote?.providerItemId,
    quote?.regularSession?.yahooSymbol,
    quote?.yahooSymbol,
  ]
    .map(cleanSymbol)
    .filter(Boolean);
}

function proxyQuoteFromDb(quote) {
  const price = Number.isFinite(Number(quote?.currentPrice)) ? Number(quote.currentPrice) : null;
  const changePercent = Number.isFinite(Number(quote?.changePercent)) ? Number(quote.changePercent) : null;
  const previousClose = Number.isFinite(Number(quote?.previousClose)) ? Number(quote.previousClose) : null;
  return {
    price,
    changePercent,
    previousClose,
    currency: String(quote?.rawPayload?.currency || '').trim() || null,
    name: String(quote?.name || quote?.displaySymbol || quote?.symbol || '').trim() || null,
    volume: Number.isFinite(Number(quote?.volume || quote?.dayVolume)) ? Number(quote.volume || quote.dayVolume) : null,
    marketCap: Number.isFinite(Number(quote?.marketCapitalization)) ? Number(quote.marketCapitalization) : null,
    source: 'marketQuotes',
  };
}

export async function handleMarketDataProxyRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/market-data/quotes') {
    if (!hasAutomationAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }

    const symbolsParam = String(url.searchParams.get('symbols') || '').trim();
    if (!symbolsParam) {
      json(res, 400, { error: 'SYMBOLS_REQUIRED', message: 'Provide comma-separated Yahoo Finance symbols via ?symbols=' });
      return true;
    }

    const symbols = [...new Set(
      symbolsParam.split(',').map((s) => s.trim()).filter(Boolean),
    )].slice(0, MAX_SYMBOLS);

    if (symbols.length === 0) {
      json(res, 400, { error: 'SYMBOLS_REQUIRED' });
      return true;
    }

    try {
      const fetchedAt = new Date().toISOString();
      const data = {};
      const quotesPage = await queryPublicMarketQuotes({
        symbols: symbols.join(','),
        limit: Math.max(30, symbols.length),
        offset: 0,
      });
      const quoteByKey = new Map();
      for (const quote of quotesPage.rows || []) {
        for (const key of quoteKeys(quote)) {
          if (!quoteByKey.has(key)) quoteByKey.set(key, quote);
        }
      }

      const missing = [];
      for (const symbol of symbols) {
        const quote = quoteByKey.get(cleanSymbol(symbol));
        if (quote) data[symbol] = proxyQuoteFromDb(quote);
        else missing.push(symbol);
      }

      if (missing.length > 0) {
        const live = await fetchYahooQuotes(missing);
        for (const symbol of missing) {
          data[symbol] = live[symbol] ? { ...live[symbol], source: 'yahooLive' } : live[symbol];
        }
      }
      json(res, 200, { data, fetchedAt, symbolCount: symbols.length });
    } catch (err) {
      json(res, 502, { error: 'QUOTE_FETCH_FAILED', message: String(err?.message || err) });
    }
    return true;
  }

  return false;
}
