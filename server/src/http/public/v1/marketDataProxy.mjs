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
      const data = await fetchYahooQuotes(symbols);
      json(res, 200, { data, fetchedAt, symbolCount: symbols.length });
    } catch (err) {
      json(res, 502, { error: 'QUOTE_FETCH_FAILED', message: String(err?.message || err) });
    }
    return true;
  }

  return false;
}
