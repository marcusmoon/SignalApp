import { queryPublicCalendar } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handlePublicCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/calendar') {
    const rows = await queryPublicCalendar({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
      symbol: url.searchParams.get('symbol') || '',
      q: url.searchParams.get('q') || '',
    });
    json(res, 200, { data: rows });
    return true;
  }
  return false;
}
