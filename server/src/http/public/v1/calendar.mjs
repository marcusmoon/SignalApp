import { queryPublicCalendar, queryPublicCalendarDateSummaries, upsertCollectionRows, deleteCalendarEvent, deduplicateCalendarEvents } from '../../../db.mjs';
import { json, readBody } from '../../shared.mjs';
import { config } from '../../../config.mjs';

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function hasIngestAccess(req) {
  const configured = cleanText(config.automationIngestToken);
  if (!configured) return false;
  const header = cleanText(req.headers['x-signal-automation-token']);
  const bearer = cleanText(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return header === configured || bearer === configured;
}

export async function handlePublicCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && (pathname === '/v1/calendar-dates' || pathname === '/v1/calendar/dates')) {
    const rows = await queryPublicCalendarDateSummaries({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
      country: url.searchParams.get('country') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/calendar') {
    const rows = await queryPublicCalendar({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
      country: url.searchParams.get('country') || '',
      symbol: url.searchParams.get('symbol') || '',
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }
  if (req.method === 'DELETE' && pathname.startsWith('/v1/calendar/')) {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'UNAUTHORIZED' });
      return true;
    }
    const id = decodeURIComponent(pathname.slice('/v1/calendar/'.length)).trim();
    if (!id) {
      json(res, 400, { error: 'ID_REQUIRED' });
      return true;
    }
    const deleted = await deleteCalendarEvent(id);
    json(res, 200, { ok: true, deleted });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/calendar/dedup') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'UNAUTHORIZED' });
      return true;
    }
    const deleted = await deduplicateCalendarEvents();
    json(res, 200, { ok: true, deleted });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/calendar/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'UNAUTHORIZED' });
      return true;
    }
    const body = await readBody(req);
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      json(res, 400, { error: 'ITEMS_REQUIRED' });
      return true;
    }
    const now = new Date().toISOString();
    const rows = items.map((item) => ({
      id: String(item.id || '').trim(),
      provider: String(item.provider || 'manual').trim(),
      providerItemId: String(item.providerItemId || item.id || '').trim(),
      type: String(item.type || 'macro').trim(),
      title: String(item.title || '').trim(),
      country: item.country ? String(item.country).trim() : null,
      symbol: item.symbol ? String(item.symbol).trim() : null,
      eventAt: item.eventAt || null,
      date: item.date || null,
      timeLabel: item.timeLabel || '',
      impact: item.impact || null,
      actual: item.actual ?? null,
      estimate: item.estimate ?? null,
      previous: item.previous ?? null,
      unit: item.unit || null,
      fiscalYear: item.fiscalYear ?? null,
      fiscalQuarter: item.fiscalQuarter ?? null,
      earningsHour: item.earningsHour || null,
      fetchedAt: item.fetchedAt || now,
    })).filter((r) => r.id && r.title);
    if (rows.length === 0) {
      json(res, 400, { error: 'NO_VALID_ITEMS' });
      return true;
    }
    await upsertCollectionRows('calendarEvents', rows);
    json(res, 200, { ok: true, count: rows.length });
    return true;
  }

  return false;
}
