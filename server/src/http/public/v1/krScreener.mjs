import { upsertCollectionRows, upsertNotificationItem } from '../../../db.mjs';
import {
  queryLatestKrScreenerRun,
  queryLatestKrScreenerSnapshot,
  queryPublicKrScreenerRuns,
} from '../../../db/repositories/krScreenerRepository.mjs';
import { config } from '../../../config.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/notificationItem.mjs';
import { resolveIngestNotifyInbox, resolveIngestSendPush } from '../../../notifications/ingestFlags.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import {
  FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW,
  FUJIMOTO_MAX_ITEMS,
  FUJIMOTO_PRESET,
  FUJIMOTO_TITLE,
} from '../../../screener/fujimoto.mjs';
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

function normalizeSymbolCode(value) {
  const raw = cleanText(value).replace(/\.(KS|KQ)$/i, '');
  if (/^\d{6}$/.test(raw)) return raw;
  return '';
}

function normalizeScreenerItem(row) {
  if (!row || typeof row !== 'object') return null;
  const symbol = normalizeSymbolCode(row.symbol);
  if (!symbol) return null;
  const id = cleanText(row.id) || `kr-screener-item:${symbol}`;
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
    rsi: numOrNull(row.rsi),
    note: cleanText(row.note).slice(0, 80),
    aiGenerated: row.aiGenerated === true,
  };
}

function normalizeSnapshotPayload(input) {
  const generatedAt = parseToUtcIsoOrNull(input?.generatedAt) || new Date().toISOString();
  const asOf = parseToUtcIsoOrNull(input?.asOf || input?.snapshotAsOf) || generatedAt;
  const generatedDate =
    utcDateOnlyOrNull(input?.generatedDate) || utcDateKeyFromInstant(generatedAt);
  const id = cleanText(input?.id) || `kr-screener-snapshot:${generatedAt}`;
  const symbols = cleanArray(input?.symbols)
    .map(normalizeScreenerItem)
    .filter(Boolean)
    .slice(0, 120);
  const universe = input?.universe && typeof input.universe === 'object' ? input.universe : {};
  return {
    id,
    generatedAt,
    generatedDate,
    asOf,
    publishedAt: parseToUtcIsoOrNull(input?.publishedAt) || generatedAt,
    locale: cleanText(input?.locale) || 'ko',
    universe: {
      kospiTop: numOrNull(universe.kospiTop) ?? 30,
      kosdaqTop: numOrNull(universe.kosdaqTop) ?? 50,
      asOf: parseToUtcIsoOrNull(universe.asOf) || asOf,
    },
    policy: {
      minTurnoverKrw:
        numOrNull(input?.policy?.minTurnoverKrw) ?? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW,
      requireAllMetrics: input?.policy?.requireAllMetrics !== false,
    },
    symbols,
    createdAt: cleanText(input?.createdAt) || generatedAt,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRunPayload(body) {
  const runIn = body?.run && typeof body.run === 'object' ? body.run : body;
  const generatedAt = parseToUtcIsoOrNull(runIn?.generatedAt) || new Date().toISOString();
  const generatedDate =
    utcDateOnlyOrNull(runIn?.generatedDate) || utcDateKeyFromInstant(generatedAt);
  const preset = cleanText(runIn?.preset).toLowerCase() || FUJIMOTO_PRESET;
  const id = cleanText(runIn?.id) || `kr-screener:${generatedAt}`;
  const items = cleanArray(body?.items ?? runIn?.items)
    .map(normalizeScreenerItem)
    .filter((row) => row && row.passed !== false)
    .slice(0, FUJIMOTO_MAX_ITEMS);
  const title = cleanText(runIn?.title) || FUJIMOTO_TITLE;
  const universe = runIn?.universe && typeof runIn.universe === 'object' ? runIn.universe : {};
  return {
    id,
    generatedAt,
    generatedDate,
    publishedAt: parseToUtcIsoOrNull(runIn?.publishedAt) || generatedAt,
    locale: cleanText(runIn?.locale) || 'ko',
    preset,
    title,
    universe: {
      kospiTop: numOrNull(universe.kospiTop) ?? 30,
      kosdaqTop: numOrNull(universe.kosdaqTop) ?? 50,
      asOf: parseToUtcIsoOrNull(universe.asOf) || null,
    },
    snapshotAsOf: parseToUtcIsoOrNull(runIn?.snapshotAsOf),
    policy: {
      ranking: cleanText(runIn?.policy?.ranking) || 'rsi_asc_then_change_percent_asc',
      maxItems: numOrNull(runIn?.policy?.maxItems) ?? FUJIMOTO_MAX_ITEMS,
      requireAllMetrics: runIn?.policy?.requireAllMetrics !== false,
    },
    items,
    pushTitle: cleanText(runIn?.pushTitle || body?.pushTitle) || title,
    pushBody:
      cleanText(runIn?.pushBody || body?.pushBody) ||
      (items.length ? `${title} · ${items.length}종` : title),
    createdAt: cleanText(runIn?.createdAt) || generatedAt,
    updatedAt: new Date().toISOString(),
  };
}

async function publishScreenerNotification(run, queuePush) {
  const notification = buildPublishedNotification(
    {
      id: `notification:push:kr_screener:${run.id}`,
      type: NOTIFICATION_TYPES.krScreener,
      title: run.pushTitle || run.title,
      body: run.pushBody || run.title,
      channel: 'push',
      priority: 'normal',
      targetType: 'all',
      sourceType: 'kr_screener',
      sourceId: run.id,
      deepLink: `/screener?date=${encodeURIComponent(run.generatedDate || '')}`,
      reason: `KR screener ${run.preset} published`,
      scheduledAt: run.publishedAt,
      payload: {
        runId: run.id,
        preset: run.preset,
        generatedDate: run.generatedDate,
      },
    },
    { queuePush },
  );
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

export async function handlePublicKrScreenerRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/screener/kr/snapshot/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const input = body?.snapshot && typeof body.snapshot === 'object' ? body.snapshot : body;
    const snapshot = normalizeSnapshotPayload(input);
    if (!snapshot.symbols.length && !cleanText(input?.id)) {
      json(res, 400, { error: 'INVALID_KR_SCREENER_SNAPSHOT' });
      return true;
    }
    await upsertCollectionRows('krScreenerSnapshots', [snapshot]);
    json(res, 201, { data: snapshot });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/screener/kr/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const run = normalizeRunPayload(body);
    if (!run.id || run.preset !== FUJIMOTO_PRESET) {
      json(res, 400, { error: 'INVALID_KR_SCREENER_RUN' });
      return true;
    }
    await upsertCollectionRows('krScreenerRuns', [run]);
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

  if (req.method === 'GET' && pathname === '/v1/screener/kr/universe') {
    const snapshot = await queryLatestKrScreenerSnapshot();
    if (!snapshot) {
      json(res, 200, {
        data: {
          kospiTop: 30,
          kosdaqTop: 50,
          asOf: null,
          symbols: [],
        },
        meta: { empty: true },
      });
      return true;
    }
    json(res, 200, {
      data: {
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
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/kr/snapshot') {
    const snapshot = await queryLatestKrScreenerSnapshot();
    if (!snapshot) {
      json(res, 200, { data: null, meta: { empty: true } });
      return true;
    }
    json(res, 200, { data: snapshot });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/screener/kr') {
    const preset = cleanText(url.searchParams.get('preset')).toLowerCase() || FUJIMOTO_PRESET;
    const date = cleanText(url.searchParams.get('date'));
    if (date) {
      const page = await queryPublicKrScreenerRuns({ preset, date, limit: 1 });
      json(res, 200, { data: page.rows[0] || null, meta: { preset, date, empty: !page.rows[0] } });
      return true;
    }
    const run = await queryLatestKrScreenerRun(preset);
    json(res, 200, { data: run, meta: { preset, empty: !run } });
    return true;
  }

  return false;
}
