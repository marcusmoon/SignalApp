import { readDb } from '../../../db.mjs';
import { filterCalendar, json, paginate } from '../../shared.mjs';

export async function handleAdminCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/calendar') {
    const db = await readDb();
    const page = paginate(filterCalendar(db.calendarEvents, url), url, 30, 500);
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }
  return false;
}
