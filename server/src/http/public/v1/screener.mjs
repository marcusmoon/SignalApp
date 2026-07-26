import { upsertCollectionRows, upsertNotificationItem } from '../../../db.mjs';
import {
  queryLatestScreenerRun,
  queryLatestScreenerSnapshot,
  queryPublicScreenerRuns,
  queryScreenerRunByPoolSnapshot,
} from '../../../db/repositories/screenerRepository.mjs';
import { config } from '../../../config.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/notificationItem.mjs';
import { resolveIngestNotifyInbox, resolveIngestSendPush } from '../../../notifications/ingestFlags.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import {
  FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW,
  FUJIMOTO_MAX_ITEMS,
} from '../../../screener/fujimoto.mjs';
import { buildPoolPolicy, SCREENER_RSI_PERIOD } from '../../../screener/policy.mjs';
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

/** Skill-friendly error: always include data:null alongside error.code */
function jsonError(res, status, code, extra = {}) {
  json(res, status, { data: null, error: { code, ...extra } });
}

function asOfAgeHours(asOfIso) {
  const ms = Date.parse(asOfIso || '');
  if (!Number.isFinite(ms)) return null;
  return Math.round(((Date.now() - ms) / 3_600_000) * 10) / 10;
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

function normalizeYahooSymbol(value, symbol, venue, market) {
  const raw = cleanText(value).toUpperCase();
  if (market === 'kr') {
    if (/^\d{6}\.(KS|KQ)$/.test(raw)) return raw;
    if (/^\d{6}$/.test(symbol)) {
      return venue === 'kosdaq' ? `${symbol}.KQ` : `${symbol}.KS`;
    }
    return null;
  }
  return raw || null;
}

function normalizeScreenerItem(row, market) {
  if (!row || typeof row !== 'object') return null;
  const symbol = normalizeSymbolCode(row.symbol, market);
  if (!symbol) return null;
  const venue = cleanText(row.market).toLowerCase() || null;
  const id = cleanText(row.id) || `screener-item:${market}:${symbol}`;
  return {
    id,
    symbol,
    yahooSymbol: normalizeYahooSymbol(row.yahooSymbol, symbol, venue, market),
    name: cleanText(row.name),
    market: venue,
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
    // Reserved for Fujimoto RS / Trend / Money Flow (null until feed exists).
    return3m: numOrNull(row.return3m),
    return6m: numOrNull(row.return6m),
    return12m: numOrNull(row.return12m),
    ma20: numOrNull(row.ma20),
    ma60: numOrNull(row.ma60),
    ma120: numOrNull(row.ma120),
    ma200: numOrNull(row.ma200),
    alignedMa: boolOrNull(row.alignedMa),
    pctFrom52wHigh: numOrNull(row.pctFrom52wHigh),
    volumeRatio: numOrNull(row.volumeRatio),
    foreignNetBuy: numOrNull(row.foreignNetBuy),
    institutionNetBuy: numOrNull(row.institutionNetBuy),
    note: cleanText(row.note).slice(0, 80),
    aiGenerated: row.aiGenerated === true,
  };
}

function normalizeSnapshotPayload(input) {
  const market = normalizeScreenerMarket(input?.market);
  const generatedAt = parseToUtcIsoOrNull(input?.generatedAt) || new Date().toISOString();
  // Skill copies asOf → snapshotAsOf; never leave empty.
  const asOf = parseToUtcIsoOrNull(input?.asOf || input?.snapshotAsOf) || generatedAt;
  const generatedDate =
    utcDateOnlyOrNull(input?.generatedDate) || utcDateKeyFromInstant(generatedAt);
  // Skill copies id → poolSnapshotId; always set.
  const id = cleanText(input?.id) || `screener-snapshot:${market}:${asOf}`;
  const symbols = cleanArray(input?.symbols)
    .map((row) => normalizeScreenerItem(row, market))
    .filter(Boolean)
    .slice(0, 200);
  const universe = input?.universe && typeof input.universe === 'object' ? input.universe : {};
  const defaults = buildPoolPolicy(market);
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
      ...defaults,
      minTurnoverKrw:
        numOrNull(input?.policy?.minTurnoverKrw) ??
        defaults.minTurnoverKrw ??
        (market === 'kr' ? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW : null),
      minTurnoverUsd: numOrNull(input?.policy?.minTurnoverUsd),
      requireAllMetrics: input?.policy?.requireAllMetrics !== false,
      nullMeansFail: input?.policy?.nullMeansFail !== false,
      yoyUnit: cleanText(input?.policy?.yoyUnit) || 'ratio',
      rsiPeriod: numOrNull(input?.policy?.rsiPeriod) ?? SCREENER_RSI_PERIOD,
    },
    symbols,
    createdAt: cleanText(input?.createdAt) || generatedAt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * dry-run semantics:
 * - notifyInbox=false AND sendPush=false → status=draft (not shown on app list)
 * - otherwise status=published (unless body explicitly sets status)
 * notifyInbox/sendPush alone do NOT hide the run from GET /v1/screener when status=published.
 */
function resolveRunStatus(body, runIn) {
  const explicit = cleanText(runIn?.status || body?.status).toLowerCase();
  if (explicit === 'draft' || explicit === 'published') return explicit;
  const notifyInbox = resolveIngestNotifyInbox(body);
  const sendPush = resolveIngestSendPush(body);
  if (!notifyInbox && !sendPush) return 'draft';
  return 'published';
}

function deterministicRunId(market, method, poolSnapshotId) {
  if (!poolSnapshotId) return '';
  return `screener:${market}:${method}:pool:${poolSnapshotId}`;
}

function normalizeRunPayload(body) {
  const runIn = body?.run && typeof body.run === 'object' ? body.run : body;
  const market = normalizeScreenerMarket(runIn?.market || body?.market);
  const method = normalizeScreenerMethod(runIn?.method || runIn?.preset || body?.method);
  const generatedAt = parseToUtcIsoOrNull(runIn?.generatedAt) || new Date().toISOString();
  const generatedDate =
    utcDateOnlyOrNull(runIn?.generatedDate) || utcDateKeyFromInstant(generatedAt);
  const poolSnapshotId = cleanText(runIn?.poolSnapshotId) || null;
  const status = resolveRunStatus(body, runIn);
  const stableId = deterministicRunId(market, method, poolSnapshotId);
  const id = cleanText(runIn?.id) || stableId || `screener:${market}:${method}:${generatedAt}`;
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
    status,
    generatedAt,
    generatedDate,
    publishedAt:
      status === 'published'
        ? parseToUtcIsoOrNull(runIn?.publishedAt) || generatedAt
        : parseToUtcIsoOrNull(runIn?.publishedAt),
    locale: cleanText(runIn?.locale) || (market === 'kr' ? 'ko' : 'en'),
    title,
    universe: {
      ...universe,
      asOf: parseToUtcIsoOrNull(universe.asOf) || null,
    },
    snapshotAsOf: parseToUtcIsoOrNull(runIn?.snapshotAsOf),
    poolSnapshotId,
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
        status: run.status,
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
    jsonError(res, 400, 'MARKET_REQUIRED', { markets: [...SCREENER_MARKETS] });
    return null;
  }
  return market;
}

function ensureSnapshotMeta(snapshot, market) {
  if (!snapshot) return null;
  const defaults = buildPoolPolicy(market);
  const asOf = snapshot.asOf || snapshot.generatedAt || null;
  const id = snapshot.id || (asOf ? `screener-snapshot:${market}:${asOf}` : null);
  const policy = {
    ...defaults,
    ...(snapshot.policy && typeof snapshot.policy === 'object' ? snapshot.policy : {}),
  };
  if (policy.minTurnoverKrw == null && market === 'kr') {
    policy.minTurnoverKrw = FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW;
  }
  if (policy.rsiPeriod == null) policy.rsiPeriod = SCREENER_RSI_PERIOD;
  if (!policy.yoyUnit) policy.yoyUnit = 'ratio';
  policy.nullMeansFail = policy.nullMeansFail !== false;
  return { ...snapshot, id, asOf, policy };
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
   * Convenience (app — published only)
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
      jsonError(res, 401, 'AUTOMATION_INGEST_AUTH_REQUIRED');
      return true;
    }
    const body = await readBody(req);
    const input = body?.snapshot && typeof body.snapshot === 'object' ? body.snapshot : body;
    const snapshot = normalizeSnapshotPayload(input);
    if (
      !snapshot.id ||
      !snapshot.asOf ||
      (snapshot.market === 'kr' && snapshot.policy?.minTurnoverKrw == null)
    ) {
      jsonError(res, 400, 'INVALID_SCREENER_SNAPSHOT', {
        required: ['id', 'asOf', 'policy.minTurnoverKrw'],
      });
      return true;
    }
    if (!snapshot.symbols.length && !cleanText(input?.id)) {
      jsonError(res, 400, 'INVALID_SCREENER_SNAPSHOT');
      return true;
    }
    await upsertCollectionRows('screenerSnapshots', [snapshot]);
    json(res, 201, { data: snapshot });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/screener/runs/ingest') {
    if (!hasIngestAccess(req)) {
      jsonError(res, 401, 'AUTOMATION_INGEST_AUTH_REQUIRED');
      return true;
    }
    const body = await readBody(req);
    let run = normalizeRunPayload(body);
    if (!run.id || !run.method) {
      jsonError(res, 400, 'INVALID_SCREENER_RUN');
      return true;
    }

    // Idempotency: same (market, method, poolSnapshotId) reuses prior row id.
    if (run.poolSnapshotId) {
      const existing = await queryScreenerRunByPoolSnapshot({
        market: run.market,
        method: run.method,
        poolSnapshotId: run.poolSnapshotId,
      });
      if (existing?.id) {
        run = {
          ...run,
          id: existing.id,
          createdAt: existing.createdAt || run.createdAt,
        };
      } else {
        const stable = deterministicRunId(run.market, run.method, run.poolSnapshotId);
        if (stable) run.id = stable;
      }
    }

    await upsertCollectionRows('screenerRuns', [run]);
    const notifyInbox = resolveIngestNotifyInbox(body);
    const sendPush = resolveIngestSendPush(body);
    const shouldNotify = run.status === 'published' && notifyInbox;
    const notification = shouldNotify ? await publishScreenerNotification(run, sendPush) : null;
    json(res, 201, {
      data: run,
      meta: {
        status: run.status,
        notifyInbox: shouldNotify,
        sendPush: shouldNotify && sendPush,
        inboxPublished: !!notification,
        pushQueued: shouldNotify && sendPush && !!notification,
        idempotentKey: run.poolSnapshotId
          ? `${run.market}:${run.method}:${run.poolSnapshotId}`
          : null,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/pool/universe') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    const snapshot = ensureSnapshotMeta(await queryLatestScreenerSnapshot(market), market);
    if (!snapshot) {
      json(res, 200, {
        data: { market, id: null, asOf: null, symbols: [] },
        meta: { empty: true, market, asOfAgeHours: null },
      });
      return true;
    }
    json(res, 200, {
      data: {
        market,
        id: snapshot.id,
        asOf: snapshot.asOf,
        ...snapshot.universe,
        symbols: snapshot.symbols.map((row) => ({
          symbol: row.symbol,
          yahooSymbol: row.yahooSymbol || null,
          name: row.name,
          market: row.market,
          universeRank: row.universeRank,
        })),
      },
      meta: {
        snapshotId: snapshot.id,
        asOf: snapshot.asOf,
        asOfAgeHours: asOfAgeHours(snapshot.asOf),
        count: snapshot.symbols.length,
        market,
        policy: snapshot.policy,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/pool/snapshot') {
    const market = requireMarketParam(url, res);
    if (!market) return true;
    const snapshot = ensureSnapshotMeta(await queryLatestScreenerSnapshot(market), market);
    json(res, 200, {
      data: snapshot,
      meta: {
        market,
        empty: !snapshot,
        asOfAgeHours: asOfAgeHours(snapshot?.asOf),
        /** Skill: treat asOfAgeHours > 24 as stale before screening at 08:00 KST. */
        staleAfterHours: 24,
      },
    });
    return true;
  }

  const runById = pathname.match(/^\/v1\/screener\/runs\/([^/]+)$/);
  if (req.method === 'GET' && runById) {
    const id = decodeURIComponent(runById[1]);
    const page = await queryPublicScreenerRuns({ id, limit: 1, status: '' });
    const row = page.rows[0];
    if (!row) {
      jsonError(res, 404, 'NOT_FOUND');
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
    const status = cleanText(url.searchParams.get('status')) || 'published';
    const page = await queryPublicScreenerRuns({
      market,
      method,
      date,
      status,
      limit: url.searchParams.get('limit') || 10,
      offset: url.searchParams.get('offset') || 0,
    });
    json(res, 200, {
      data: page.rows,
      meta: {
        market,
        method,
        status,
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
    // App convenience: published runs only (draft dry-runs stay hidden).
    if (date) {
      const page = await queryPublicScreenerRuns({
        market,
        method,
        date,
        status: 'published',
        limit: 1,
      });
      json(res, 200, {
        data: page.rows[0] || null,
        meta: { market, method, date, empty: !page.rows[0] },
      });
      return true;
    }
    const run = await queryLatestScreenerRun({ market, method, status: 'published' });
    json(res, 200, { data: run, meta: { market, method, empty: !run } });
    return true;
  }

  return false;
}
