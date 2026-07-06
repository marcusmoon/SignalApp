import { upsertCollectionRows, upsertNotificationItem } from '../../../db.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/outbox.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import { config } from '../../../config.mjs';
import { queryPublicMarketBriefings } from '../../../db/repositories/marketBriefingsRepository.mjs';
import { parseToUtcIsoOrNull, utcDateKeyFromInstant, utcDateOnlyOrNull } from '../../../time/utc.mjs';
import { json, readBody } from '../../shared.mjs';

const ALLOWED_MARKETS = new Set(['kr', 'us']);
const ALLOWED_SESSIONS = new Set(['morning', 'lunch', 'evening', 'overnight', 'close']);

function cleanText(value) {
  return String(value || '').trim();
}

function cleanArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeBriefingDate(value, publishedAt) {
  return (
    utcDateOnlyOrNull(value) ||
    utcDateKeyFromInstant(publishedAt) ||
    utcDateKeyFromInstant(new Date().toISOString())
  );
}

function normalizeBriefingPayload(input) {
  const market = cleanText(input?.market).toLowerCase();
  const session = cleanText(input?.session).toLowerCase();
  const id = cleanText(input?.id);
  const title = cleanText(input?.title);
  const headline = cleanText(input?.headline);
  const summary = cleanText(input?.summary);
  const publishedAt = parseToUtcIsoOrNull(input?.publishedAt) || new Date().toISOString();
  if (!id || !title || !headline || !ALLOWED_MARKETS.has(market) || !ALLOWED_SESSIONS.has(session)) return null;
  const pushCandidate = input?.pushCandidate !== false;
  return {
    id,
    market,
    session,
    title,
    headline,
    summary,
    overview: cleanArray(input?.overview).map(cleanText).filter(Boolean).slice(0, 8),
    sectors: cleanArray(input?.sectors).slice(0, 12).map((s) => ({
      name: cleanText(s?.name),
      trend: cleanText(s?.trend),
      summary: cleanText(s?.summary),
    })).filter((s) => s.name),
    companies: cleanArray(input?.companies).slice(0, 12),
    macro: cleanArray(input?.macro).slice(0, 8),
    sourceRefs: cleanArray(input?.sourceRefs).slice(0, 20),
    briefingDate: normalizeBriefingDate(input?.briefingDate || input?.generatedDate, publishedAt),
    publishedAt,
    pushCandidate,
    pushTitle: cleanText(input?.pushTitle) || title,
    pushBody: cleanText(input?.pushBody) || headline,
    createdAt: cleanText(input?.createdAt) || publishedAt,
    updatedAt: new Date().toISOString(),
  };
}

function hasIngestAccess(req) {
  const configured = cleanText(config.automationIngestToken);
  if (!configured) return false;
  const header = cleanText(req.headers['x-signal-automation-token']);
  const bearer = cleanText(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return header === configured || bearer === configured;
}

async function publishBriefingNotification(briefing, queuePush) {
  if (!briefing?.pushCandidate) return null;
  const sessionTab = `${briefing.market}-${briefing.session}`;
  const params = new URLSearchParams();
  if (briefing.briefingDate) params.set('date', briefing.briefingDate);
  if (sessionTab) params.set('session', sessionTab);
  const deepLink = params.toString() ? `/signal?${params.toString()}` : '/signal';
  const notification = buildPublishedNotification(
    {
      id: `notification:push:market_briefing:${briefing.id}`,
      type: NOTIFICATION_TYPES.marketBriefing,
      title: briefing.pushTitle || briefing.title,
      body: briefing.pushBody || briefing.headline,
      channel: 'push',
      priority: briefing.market === 'us' ? 'high' : 'normal',
      targetType: 'all',
      sourceType: 'market_briefing',
      sourceId: briefing.id,
      deepLink,
      symbols: cleanArray(briefing.companies).map((company) => company?.symbol).filter(Boolean),
      sourceRefs: briefing.sourceRefs,
      reason: `${briefing.market}/${briefing.session} market briefing updated`,
      scheduledAt: briefing.publishedAt,
      payload: {
        briefingId: briefing.id,
        market: briefing.market,
        session: briefing.session,
        briefingDate: briefing.briefingDate,
      },
    },
    { queuePush },
  );
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

function publicBriefing(item) {
  return item;
}

export async function handlePublicMarketBriefingRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/market-briefings/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const input = body?.briefing && typeof body.briefing === 'object' ? body.briefing : body;
    const briefing = normalizeBriefingPayload(input);
    if (!briefing) {
      json(res, 400, { error: 'INVALID_MARKET_BRIEFING' });
      return true;
    }
    await upsertCollectionRows('marketBriefings', [briefing]);
    const notification = await publishBriefingNotification(briefing, body?.sendPush !== false);
    json(res, 201, { data: publicBriefing(briefing), meta: { notificationPublished: !!notification, pushQueued: body?.sendPush !== false && !!notification } });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/market-briefings') {
    const page = await queryPublicMarketBriefings({
      market: url.searchParams.get('market'),
      session: url.searchParams.get('session'),
      date: url.searchParams.get('date'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      limit: url.searchParams.get('limit') || 10,
      offset: url.searchParams.get('offset') || 0,
    });
    json(res, 200, {
      data: page.rows.map(publicBriefing),
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

  return false;
}
