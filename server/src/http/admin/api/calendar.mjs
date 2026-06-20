import { deleteCalendarEvent, queryPublicCalendar, upsertCollectionRows } from '../../../db.mjs';
import { json, readBody } from '../../shared.mjs';
import {
  deleteCalendarEventCodeMappingRow,
  listCalendarEventCodeMappingRows,
  upsertCalendarEventCodeMappingRow,
} from '../../../db/repositories/calendarEventCodeMappingsRepository.mjs';
import { matchCalendarEventCode } from '../../../calendar/eventKey.mjs';

export async function handleAdminCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/admin/api/calendar/events') {
    const body = await readBody(req);
    const row = calendarEventBody(body);
    if (!row.title) {
      json(res, 400, { error: 'CALENDAR_EVENT_TITLE_REQUIRED' });
      return true;
    }
    await upsertCollectionRows('calendarEvents', [row]);
    json(res, 200, { ok: true });
    return true;
  }

  const eventMatch = pathname.match(/^\/admin\/api\/calendar\/events\/([^/]+)$/);
  if ((req.method === 'PATCH' || req.method === 'PUT') && eventMatch) {
    const id = decodeURIComponent(eventMatch[1]);
    const body = await readBody(req);
    const row = calendarEventBody(body);
    if (!row.title) {
      json(res, 400, { error: 'CALENDAR_EVENT_TITLE_REQUIRED' });
      return true;
    }
    await deleteCalendarEvent(id);
    await upsertCollectionRows('calendarEvents', [row]);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'DELETE' && eventMatch) {
    const id = decodeURIComponent(eventMatch[1]);
    const deleted = await deleteCalendarEvent(id);
    json(res, 200, { ok: true, deleted });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/calendar/event-code-mappings') {
    const rows = await listCalendarEventCodeMappingRows({
      eventType: url.searchParams.get('eventType') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/calendar/event-code-mappings') {
    const body = await readBody(req);
    try {
      const row = await upsertCalendarEventCodeMappingRow(body || {});
      json(res, 200, { ok: true, data: row });
    } catch (error) {
      json(res, 400, { error: error?.message || 'CALENDAR_MAPPING_SAVE_FAILED' });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/calendar/event-code-mappings/test') {
    const body = await readBody(req);
    const mappings = await listCalendarEventCodeMappingRows({ enabled: true });
    const code = matchCalendarEventCode(
      {
        type: body?.eventType || body?.type || 'macro',
        title: body?.title || '',
      },
      mappings,
    );
    json(res, 200, { ok: true, code });
    return true;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/admin/api/calendar/event-code-mappings/')) {
    const id = decodeURIComponent(pathname.slice('/admin/api/calendar/event-code-mappings/'.length)).trim();
    const deleted = await deleteCalendarEventCodeMappingRow(id);
    json(res, 200, { ok: true, deleted });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/calendar') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const rows = await queryPublicCalendar({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
      country: url.searchParams.get('country') || '',
      symbol: url.searchParams.get('symbol') || '',
      q: url.searchParams.get('q') || '',
      limit: String(pageSize + 1),
      offset: String((page - 1) * pageSize),
    });
    const data = rows.slice(0, pageSize);
    json(res, 200, {
      data,
      page,
      pageSize,
      total: (page - 1) * pageSize + data.length + (rows.length > pageSize ? 1 : 0),
      totalPages: rows.length > pageSize ? page + 1 : page,
    });
    return true;
  }
  return false;
}

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function nullable(value) {
  const text = cleanText(value);
  return text || null;
}

function numberOrNull(value) {
  if (value == null || cleanText(value) === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calendarEventBody(body = {}) {
  const now = new Date().toISOString();
  return {
    provider: nullable(body.provider) || 'admin',
    providerItemId: nullable(body.providerItemId) || nullable(body.sourceEventId),
    type: nullable(body.type) || 'macro',
    title: cleanText(body.title),
    country: nullable(body.country) || 'US',
    symbol: nullable(body.symbol)?.toUpperCase() || null,
    date: nullable(body.date),
    eventAt: nullable(body.eventAt),
    timeLabel: nullable(body.timeLabel),
    timezone: nullable(body.timezone),
    impact: nullable(body.impact),
    importance: nullable(body.importance),
    actual: numberOrNull(body.actual),
    estimate: numberOrNull(body.estimate),
    previous: numberOrNull(body.previous),
    unit: nullable(body.unit),
    fiscalYear: numberOrNull(body.fiscalYear),
    fiscalQuarter: numberOrNull(body.fiscalQuarter),
    earningsHour: nullable(body.earningsHour),
    companyName: nullable(body.companyName),
    source: nullable(body.source) || 'admin',
    sourceEventId: nullable(body.sourceEventId) || nullable(body.providerItemId),
    url: nullable(body.url),
    createdAt: nullable(body.createdAt) || now,
    updatedAt: now,
    fetchedAt: now,
  };
}
