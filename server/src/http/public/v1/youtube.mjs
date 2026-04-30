import { readDb } from '../../../db.mjs';
import { filterYoutube, json, paginate } from '../../shared.mjs';

export async function handlePublicYoutubeRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/youtube') {
    const db = await readDb();
    const page = paginate(filterYoutube(db.youtubeVideos, url), url, 30, 100);
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
