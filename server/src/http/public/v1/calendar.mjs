import { readDb } from '../../../db.mjs';
import { filterCalendar, json } from '../../shared.mjs';

export async function handlePublicCalendarRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/calendar') {
    const db = await readDb();
    json(res, 200, { data: filterCalendar(db.calendarEvents, url) });
    return true;
  }
  return false;
}
