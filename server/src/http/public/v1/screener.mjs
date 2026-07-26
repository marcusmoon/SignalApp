import { upsertCollectionRows, upsertNotificationItem } from '../../../db.mjs';
import {
  queryLatestScreenerRun,
  queryLatestScreenerSnapshot,
  queryPublicScreenerRuns,
} from '../../../db/repositories/screenerRepository.mjs';
import { config } from '../../../config.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/notificationItem.mjs';
import { resolveIngestNotifyInbox, resolveIngestSendPush } from '../../../notifications/ingestFlags.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import {
  FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW,
  FUJIMOTO_MAX_ITEMS,
} from '../../../screener/fujimoto.mjs';
import {
  defaultMethodTitle,
  listScreenerMethods,
  normalizeScreenerMarket,
  normalizeScreenerMethod,
  SCREENER_MARKETS,
} from '../../../screener/markets.mjs';
import { parseToUtcIsoOrNull, utcDateOnlyOrNull, utcDateKeyFromInstant } from '../../../time/utc.mjs';
import { json, readBody } from '../../shared.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function cleanArray(value) {
  return Array.isArray(value) ? value : [];
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(value) {
  if (typeof value === 'boolean') return value;
  return null;
}

function hasIngestAccess(req) {
  const configured = cleanText(config.automationIngestToken);
  if (!configured) return false;
  const header = cleanText(req.headers['x-signal-automation-token']);
  const bearer = cleanText(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return header === configured || bearer === configured;
}

/** KR: 6-digit. Global: ticker letters/numbers (e.g. AAPL, BRK.B). */
function normalizeSymbolCode(value, market) {
  const raw = cleanText(value);
  if (market === 'kr') {
    const code = raw.replace(/\.(KS|KQ)$/i, '');
    return /^\d{6}$/.test(code) ? code : '';
  }
  const ticker = raw.toUpperCase();
  if (/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) return ticker;
  return '';
}

function normalizeScreenerItem(row, market) {
  if (!row || typeof row !== 'object') return null;
  const symbol = normalizeSymbolCode(row.symbol, market);
  if (!symbol) return null;
  const id = cleanText(row.id) || `screener-item:${market}:${symbol}`;
  return {
    id,
    symbol,
    name: cleanText(row.name),
    market: cleanText(row.market).toLowerCase() || null,
    universeRank: numOrNull(row.universeRank),
    passed: row.passed !== false,
    currentPrice: numOrNull(row.currentPrice),
    changePercent: numOrNull(row.changePercent),
    per: numOrNull(row.per),
    pbr: numOrNull(row.pbr),
    revenueYoY: numOrNull(row.revenueYoY),
    operatingProfitYoY: numOrNull(row.operatingProfitYoY),
    netProfitYoY: numOrNull(row.netProfitYoY),
    dividend: boolOrNull(row.dividend),
    dividendGrowthCapacity: boolOrNull(row.dividendGrowthCapacity),
    turnoverKrw: numOrNull(row.turnoverKrw),
    turnoverUsd: numOrNull(row.turnoverUsd),
    rsi: numOrNull(row.rsi),
    note: cleanText(row.note).slice(0, 80),
    aiGenerated: row.aiGenerated === true,
  };
}

function normalizeSnapshotPayload(input) {
  const market = normalizeScreenerMarket(input?.market);
  const generatedAt = parseToUtcIsoOrNull(input?.generatedAt) || new Date().toISOString();
  const asOf = parseToUtcIsoOrNull(input?.asOf || input?.snapshotAsOf) || generatedAt;
  const generatedDate =
    utcDateOnlyOrNull(input?.generatedDate) || utcDateKeyFromInstant(generatedAt);
  const id = cleanText(input?.id) || `screener-snapshot:${market}:${generatedAt}`;
  const symbols = cleanArray(input?.symbols)
    .map((row) => normalizeScreenerItem(row, market))
    .filter(Boolean)
    .slice(0, 200);
  const universe = input?.universe && typeof input.universe === 'object' ? input.universe : {};
  return {
    id,
    market,
    generatedAt,
    generatedDate,
    asOf,
    publishedAt: parseToUtcIsoOrNull(input?.publishedAt) || generatedAt,
    locale: cleanText(input?.locale) || (market === 'kr' ? 'ko' : 'en'),
    universe: {
      ...universe,
      asOf: parseToUtcIsoOrNull(universe.asOf) || asOf,
      kospiTop: numOrNull(universe.kospiTop),
      kosdaqTop: numOrNull(universe.kosdaqTop),
      size: numOrNull(universe.size) ?? symbols.length,
    },
    policy: {
      minTurnoverKrw:
        numOrNull(input?.policy?.minTurnoverKrw) ??
        (market === 'kr' ? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW : null),
      minTurnoverUsd: numOrNull(input?.policy?.minTurnoverUsd),
      requireAllMetrics: input?.policy?.requireAllMetrics !== false,
    },
    symbols,
    createdAt: cleanText(input?.createdAt) || generatedAt,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRunPayload(body) {
  const runIn = body?.run && typeof body.run === 'object' ? body.run : body;
  const market = normalizeScreenerMarket(runIn?.market || body?.market);
  const method = normalizeScreenerMethod(runIn?.method || runIn?.preset || body?.method);
  const generatedAt = parseToUtcIsoOrNull(runIn?.generatedAt) || new Date().toISOString();
  const generatedDate =
    utcDateOnlyOrNull(runIn?.generatedDate) || utcDateKeyFromInstant(generatedAt);
  const id = cleanText(runIn?.id) || `screener:${market}:${method}:${generatedAt}`;
  const items = cleanArray(body?.items ?? runIn?.items)
    .map((row) => normalizeScreenerItem(row, market))
    .filter((row) => row && row.passed !== false)
    .slice(0, FUJIMOTO_MAX_ITEMS);
  const title = cleanText(runIn?.title) || defaultMethodTitle(market, method);
  const universe = runIn?.universe && typeof runIn.universe === 'object' ? runIn.universe : {};
  return {
    id,
    market,
    method,
    generatedAt,
    generatedDate,
    publishedAt: parseToUtcIsoOrNull(runIn?.publishedAt) || generatedAt,
    locale: cleanText(runIn?.locale) || (market === 'kr' ? 'ko' : 'en'),
    title,
    universe: {
      ...universe,
      asOf: parseToUtcIsoOrNull(universe.asOf) || null,
    },
    snapshotAsOf: parseToUtcIsoOrNull(runIn?.snapshotAsOf),
    poolSnapshotId: cleanText(runIn?.poolSnapshotId) || null,
    policy: {
      ranking: cleanText(runIn?.policy?.ranking) || 'rsi_asc_then_change_percent_asc',
      maxItems: numOrNull(runIn?.policy?.maxItems) ?? FUJIMOTO_MAX_ITEMS,
      requireAllMetrics: runIn?.policy?.requireAllMetrics !== false,
    },
    items,
    pushTitle: cleanText(runIn?.pushTitle || body?.pushTitle) || title,
    pushBody:
      cleanText(runIn?.pushBody || body?.pushBody) ||
      (items.length ? `${title} · ${items.length}` : title),
    createdAt: cleanText(runIn?.createdAt) || generatedAt,
    updatedAt: new Date().toISOString(),
  };
}

async function publishScreenerNotification(run, queuePush) {
  const notification = buildPublishedNotification(
    {
      id: `notification:push:screener:${run.id}`,
      type: NOTIFICATION_TYPES.screener,
      title: run.pushTitle || run.title,
      body: run.pushBody || run.title,
      channel: 'push',
      priority: 'normal',
      targetType: 'all',
      sourceType: 'screener',
      sourceId: run.id,
      deepLink: `/screener?market=${encodeURIComponent(run.market)}&method=${encodeURIComponent(run.method)}`,
      reason: `Screener ${run.market}/${run.method} published`,
      scheduledAt: run.publishedAt,
      payload: {
        runId: run.id,
        market: run.market,
        method: run.method,
        generatedDate: run.generatedDate,
      },
    },
    { queuePush },
  );
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

function requireMarketParam(url, res) {
  const market = normalizeScreenerMarket(url.searchParams.get('market'), { fallback: '' });
  if (!SCREENER_MARKETS.has(market)) {
    json(res, 400, { error: 'MARKET_REQUIRED', markets: [...SCREENER_MARKETS] });
    return null;
  }
  return market;
}

export async function handlePublicScreenerRoutes({ req, res, url, pathname }) {
  /*
   * Pool (shared universe/metrics per market — all methods read this)
   *   GET  /v1/screener/pool/universe?market=kr|global
   *   GET  /v1/screener/pool/snapshot?market=kr|global
   *   POST /v1/screener/pool/snapshot/ingest
   *
   * Methods (catalog)
   *   GET  /v1/screener/methods?market=kr|global
   *
   * Runs (curation by method)
   *   GET  /v1/screener/runs?market=&method=
   *   GET  /v1/screener/runs/:id
   *   POST /v1/screener/runs/ingest
   *
   * Convenience (app)
   *   GET  /v1/screener?market=&method=
   */

  if (req.method === 'GET' && pathname === '/v1/screener/methods') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    json(res, 200, {
      data: listScreenerMethods(market),
      meta: { market, markets: [...SCREENER_MARKETS] },
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/screener/pool/snapshot/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const input = body?.snapshot && typeof body.snapshot === 'object' ? body.snapshot : body;
    const snapshot = normalizeSnapshotPayload(input);
    if (!snapshot.symbols.length && !cleanText(input?.id)) {
      json(res, 400, { error: 'INVALID_SCREENER_SNAPSHOT' });
      return true;
    }
    await upsertCollectionRows('screenerSnapshots', [snapshot]);
    json(res, 201, { data: snapshot });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/screener/runs/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const run = normalizeRunPayload(body);
    if (!run.id || !run.method) {
      json(res, 400, { error: 'INVALID_SCREENER_RUN' });
      return true;
    }
    await upsertCollectionRows('screenerRuns', [run]);
    const notifyInbox = resolveIngestNotifyInbox(body);
    const sendPush = resolveIngestSendPush(body);
    const notification = notifyInbox ? await publishScreenerNotification(run, sendPush) : null;
    json(res, 201, {
      data: run,
      meta: {
        notifyInbox,
        sendPush,
        inboxPublished: !!notification,
        pushQueued: sendPush && !!notification,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/pool/universe') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    const snapshot = await queryLatestScreenerSnapshot(market);
    if (!snapshot) {
      json(res, 200, {
        data: { market, asOf: null, symbols: [] },
        meta: { empty: true, market },
      });
      return true;
    }
    json(res, 200, {
      data: {
        market,
        ...snapshot.universe,
        symbols: snapshot.symbols.map((row) => ({
          symbol: row.symbol,
          name: row.name,
          market: row.market,
          universeRank: row.universeRank,
        })),
      },
      meta: {
        snapshotId: snapshot.id,
        asOf: snapshot.asOf,
        count: snapshot.symbols.length,
        market,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/pool/snapshot') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    const snapshot = await queryLatestScreenerSnapshot(market);
    json(res, 200, { data: snapshot, meta: { market, empty: !snapshot } });
    return true;
  }

  const runById = pathname.match(/^\/v1\/screener\/runs\/([^/]+)$/);
  if (req.method === 'GET' && runById) {
    const id = decodeURIComponent(runById[1]);
    const page = await queryPublicScreenerRuns({ id, limit: 1 });
    const row = page.rows[0];
    if (!row) {
      json(res, 404, { error: 'NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: row });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/runs') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    const method = normalizeScreenerMethod(url.searchParams.get('method'));
    const date = cleanText(url.searchParams.get('date'));
    const page = await queryPublicScreenerRuns({
      market,
      method,
      date,
      limit: url.searchParams.get('limit') || 10,
      offset: url.searchParams.get('offset') || 0,
    });
    json(res, 200, {
      data: page.rows,
      meta: {
        market,
        method,
        limit: page.limit,
        offset: page.offset,
        total: page.total,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    const method = normalizeScreenerMethod(url.searchParams.get('method'));
    const date = cleanText(url.searchParams.get('date'));
    if (date) {
      const page = await queryPublicScreenerRuns({ market, method, date, limit: 1 });
      json(res, 200, {
        data: page.rows[0] || null,
        meta: { market, method, date, empty: !page.rows[0] },
      });
      return true;
    }
    const run = await queryLatestScreenerRun({ market, method });
    json(res, 200, { data: run, meta: { market, method, empty: !run } });
    return true;
  }

  return false;
}
