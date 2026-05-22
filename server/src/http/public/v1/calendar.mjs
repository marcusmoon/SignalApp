import { queryPublicCalendar, queryPublicCalendarDateSummaries } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/calendar-dates') {
    const rows = await queryPublicCalendarDateSummaries({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/calendar') {
    const rows = await queryPublicCalendar({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
      symbol: url.searchParams.get('symbol') || '',
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }
  return false;
}
