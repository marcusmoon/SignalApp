import { readDb, updateDb, upsertById } from '../../../db.mjs';
import { runPollingJob } from '../../../jobs/runner.mjs';
import { fetchYoutubeVideosByIds } from '../../../providers/youtube/youtube.mjs';
import { filterYoutube, json, paginate, readBody } from '../../shared.mjs';

export async function handleAdminYoutubeRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/youtube') {
    const db = await readDb();
    const page = paginate(filterYoutube(db.youtubeVideos, url), url, 30, 100);
    const channels = [...new Set(db.youtubeVideos.map((item) => item.channel).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    json(res, 200, {
      data: page.rows,
      channels,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/youtube/refresh-selected') {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      const result = await runPollingJob('youtube_economy_reconcile', { force: true, trigger: 'manual' });
      json(res, 200, { data: { requested: 0, run: result } });
      return true;
    }
    const result = await updateDb(async (db) => {
      const idSet = new Set(ids);
      const videoIds = db.youtubeVideos
        .filter((item) => idSet.has(item.id))
        .map((item) => item.videoId || item.providerItemId)
        .filter(Boolean);
      const rows = await fetchYoutubeVideosByIds(videoIds, { order: 'date' });
      for (const row of rows) upsertById(db.youtubeVideos, row);
      return { requested: ids.length, updated: rows.length };
    });
    json(res, 200, { data: result });
    return true;
  }

  return false;
}
