import { upsertCollectionRows, upsertNotificationItem } from '../../../db.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/notificationItem.mjs';
import { resolveIngestNotifyInbox, resolveIngestSendPush } from '../../../notifications/ingestFlags.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import { config } from '../../../config.mjs';
import { queryPublicEtfInsights } from '../../../db/repositories/etfInsightsRepository.mjs';
import { normalizeSourceRefs } from '../../../sources/normalizeSourceRefs.mjs';
import { parseToUtcIsoOrNull, utcDateOnlyOrNull, utcDateKeyFromInstant } from '../../../time/utc.mjs';
import { json, readBody } from '../../shared.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function cleanArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasIngestAccess(req) {
  const configured = cleanText(config.automationIngestToken);
  if (!configured) return false;
  const header = cleanText(req.headers['x-signal-automation-token']);
  const bearer = cleanText(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return header === configured || bearer === configured;
}

function normalizeEtfInsightPayload(input) {
  const id = cleanText(input?.id);
  const title = cleanText(input?.title);
  const summary = cleanText(input?.summary);
  const period = cleanText(input?.period).toLowerCase() || 'daily';
  const publishedAt = parseToUtcIsoOrNull(input?.publishedAt) || new Date().toISOString();
  if (!id || !title) return null;
  const insightDate =
    utcDateOnlyOrNull(input?.insightDate) ||
    utcDateKeyFromInstant(publishedAt);
  return {
    id,
    period,
    title,
    summary,
    insightDate,
    publishedAt,
    heatmap: cleanArray(input?.heatmap).slice(0, 50),
    themes: cleanArray(input?.themes).slice(0, 10),
    flowHighlights: cleanArray(input?.flowHighlights).slice(0, 10),
    rotation: input?.rotation && typeof input.rotation === 'object' ? input.rotation : null,
    insights: cleanArray(input?.insights).map(cleanText).filter(Boolean).slice(0, 10),
    sourceRefs: normalizeSourceRefs(input?.sourceRefs, { limit: 20 }),
    pushTitle: cleanText(input?.pushTitle) || title,
    pushBody: cleanText(input?.pushBody) || summary,
    createdAt: cleanText(input?.createdAt) || publishedAt,
    updatedAt: new Date().toISOString(),
  };
}

async function publishEtfInsightNotification(insight, queuePush) {
  const notification = buildPublishedNotification(
    {
      id: `notification:push:etf_insight:${insight.id}`,
      type: NOTIFICATION_TYPES.etfInsight,
      title: insight.pushTitle || insight.title,
      body: insight.pushBody || insight.summary,
      channel: 'push',
      priority: 'normal',
      targetType: 'all',
      sourceType: 'etf_insight',
      sourceId: insight.id,
      deepLink: '/signal',
      sourceRefs: insight.sourceRefs,
      reason: `ETF insight ${insight.period} published`,
      scheduledAt: insight.publishedAt,
      payload: {
        insightId: insight.id,
        period: insight.period,
        insightDate: insight.insightDate,
      },
    },
    { queuePush },
  );
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

export async function handlePublicEtfInsightRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/etf-insights/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const input = body?.insight && typeof body.insight === 'object' ? body.insight : body;
    const insight = normalizeEtfInsightPayload(input);
    if (!insight) {
      json(res, 400, { error: 'INVALID_ETF_INSIGHT' });
      return true;
    }
    await upsertCollectionRows('etfInsights', [insight]);
    const notifyInbox = resolveIngestNotifyInbox(body);
    const sendPush = resolveIngestSendPush(body);
    const notification = notifyInbox ? await publishEtfInsightNotification(insight, sendPush) : null;
    json(res, 201, {
      data: insight,
      meta: {
        notifyInbox,
        sendPush,
        inboxPublished: !!notification,
        pushQueued: sendPush && !!notification,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/etf-insights') {
    const page = await queryPublicEtfInsights({
      period: url.searchParams.get('period') || '',
      date: url.searchParams.get('date') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      limit: url.searchParams.get('limit') || 10,
      offset: url.searchParams.get('offset') || 0,
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

  const byId = pathname.match(/^\/v1\/etf-insights\/([^/]+)$/);
  if (req.method === 'GET' && byId) {
    const id = decodeURIComponent(byId[1]);
    const result = await queryPublicEtfInsights({ id, limit: 1 });
    const row = result.rows[0];
    if (!row) {
      json(res, 404, { error: 'NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: row });
    return true;
  }

  return false;
}
