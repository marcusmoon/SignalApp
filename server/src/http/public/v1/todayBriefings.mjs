import { upsertCollectionRows } from '../../../db.mjs';
import { config } from '../../../config.mjs';
import { queryPublicTodayBriefings } from '../../../db/repositories/todayBriefingsRepository.mjs';
import { parseToUtcIsoOrNull, utcDateKeyFromInstant, utcDateOnlyOrNull } from '../../../time/utc.mjs';
import { json, readBody } from '../../shared.mjs';

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

function normalizeTodayBriefingPayload(input) {
  const id = cleanText(input?.id);
  const title = cleanText(input?.title);
  const headline = cleanText(input?.headline);
  const publishedAt = parseToUtcIsoOrNull(input?.publishedAt) || new Date().toISOString();
  const generatedAt = parseToUtcIsoOrNull(input?.generatedAt) || publishedAt;
  if (!id || !title || !headline) return null;
  const summary = cleanText(input?.summary);
  const pushCandidate = input?.pushCandidate === true;
  return {
    id,
    locale: cleanText(input?.locale) || 'ko',
    title,
    headline,
    summary,
    keyPoints: cleanArray(input?.keyPoints || input?.overview).map(cleanText).filter(Boolean).slice(0, 8),
    sections: cleanArray(input?.sections).slice(0, 12),
    marketSnapshot: input?.marketSnapshot && typeof input.marketSnapshot === 'object' ? input.marketSnapshot : null,
    sourceRefs: cleanArray(input?.sourceRefs).slice(0, 30),
    relatedDigestIds: cleanArray(input?.relatedDigestIds).map(cleanText).filter(Boolean).slice(0, 30),
    relatedMarketBriefingIds: cleanArray(input?.relatedMarketBriefingIds).map(cleanText).filter(Boolean).slice(0, 30),
    briefingDate: normalizeBriefingDate(input?.briefingDate || input?.generatedDate, publishedAt),
    generatedAt,
    publishedAt,
    status: cleanText(input?.status) || 'published',
    pushCandidate,
    pushTitle: cleanText(input?.pushTitle) || title,
    pushBody: cleanText(input?.pushBody) || headline,
    createdAt: cleanText(input?.createdAt) || generatedAt,
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

export async function handlePublicTodayBriefingRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/today-briefings/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const input = body?.briefing && typeof body.briefing === 'object' ? body.briefing : body;
    const briefing = normalizeTodayBriefingPayload(input);
    if (!briefing) {
      json(res, 400, { error: 'INVALID_TODAY_BRIEFING' });
      return true;
    }
    await upsertCollectionRows('todayBriefings', [briefing]);
    json(res, 201, { data: briefing, meta: { notificationQueued: false } });
    return true;
  }

  if (req.method === 'GET' && (pathname === '/v1/today-briefing' || pathname === '/v1/today-briefings')) {
    const page = await queryPublicTodayBriefings({
      id: url.searchParams.get('id'),
      locale: url.searchParams.get('locale') || 'ko',
      status: url.searchParams.get('status') || 'published',
      date: url.searchParams.get('date'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      limit: url.searchParams.get('limit') || (pathname === '/v1/today-briefing' ? 1 : 10),
      offset: url.searchParams.get('offset') || 0,
    });
    if (pathname === '/v1/today-briefing') {
      json(res, 200, { data: page.rows[0] || null, meta: { found: page.rows.length > 0 } });
      return true;
    }
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

  return false;
}
