import { queryPublicCalendar } from '../../../db.mjs';
import { json } from '../../shared.mjs';

export async function handleAdminCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/calendar') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const rows = await queryPublicCalendar({
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      type: url.searchParams.get('type') || '',
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
