import { listYoutubeVideos, queryPublicYoutube, queryPublicYoutubeChannels, upsertCollectionRows } from '../../../db.mjs';
import { runPollingJob } from '../../../jobs/runner.mjs';
import { fetchYoutubeVideosByIds } from '../../../providers/youtube/youtube.mjs';
import { json, readBody } from '../../shared.mjs';

export async function handleAdminYoutubeRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/youtube') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const result = await queryPublicYoutube({
      q: url.searchParams.get('q') || '',
      channel: url.searchParams.get('channel') || '',
      channelHandles: url.searchParams.get('channelHandles') || '',
      sort: url.searchParams.get('sort') || '',
      limit: String(pageSize),
      offset: String((page - 1) * pageSize),
    });
    const channels = (await queryPublicYoutubeChannels()).map((item) => item.title).filter(Boolean);
    json(res, 200, {
      data: result.rows,
      channels,
      page,
      pageSize,
      total: result.total,
      totalPages: result.hasMore ? page + 1 : page,
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
    const idSet = new Set(ids);
    const videoIds = (await listYoutubeVideos())
      .filter((item) => idSet.has(item.id))
      .map((item) => item.videoId || item.providerItemId)
      .filter(Boolean);
    const rows = await fetchYoutubeVideosByIds(videoIds, { order: 'date' });
    await upsertCollectionRows('youtubeVideos', rows);
    const result = { requested: ids.length, updated: rows.length };
    json(res, 200, { data: result });
    return true;
  }

  return false;
}
