import { ensureYoutubeChannelsCatalog } from '../youtubeChannels.mjs';
import { queryKysely } from '../kysely/client.mjs';
import { normalizeYoutubeHandle } from '../../youtubeCuration.mjs';
import {
  cleanText,
  pageOptions,
  paginatedSqlRows,
  payloadFromRow,
  parseToUtcIsoOrNull,
  sqlStringList,
} from './publicHelpers.mjs';

const YOUTUBE_ROW_COLUMNS = `
  id, position, channel, published_at, fetched_at, updated_at,
  provider, provider_item_id, video_id, topic, title,
  channel_id, channel_handle, description, duration,
  view_count, thumbnail_url, sort_bucket, sort_buckets
`;

export function rowToYoutubeItem(row) {
  if (!row) return null;
  const sortBuckets = Array.isArray(row.sort_buckets) ? row.sort_buckets.filter(Boolean) : [];
  return {
    id: row.id,
    provider: row.provider || 'youtube',
    providerItemId: row.provider_item_id || row.video_id || null,
    videoId: row.video_id || row.provider_item_id || null,
    topic: row.topic || null,
    title: row.title || '',
    channel: row.channel || '',
    channelId: row.channel_id || '',
    channelHandle: row.channel_handle || null,
    description: row.description || '',
    publishedAt: parseToUtcIsoOrNull(row.published_at),
    duration: row.duration || '',
    viewCount: Number(row.view_count) || 0,
    thumbnailUrl: row.thumbnail_url || null,
    sortBucket: row.sort_bucket || undefined,
    sortBuckets: sortBuckets.length > 0 ? sortBuckets : undefined,
    fetchedAt: parseToUtcIsoOrNull(row.fetched_at),
    updatedAt: parseToUtcIsoOrNull(row.updated_at),
  };
}

function publicYoutube(item) {
  return {
    id: item.id,
    provider: item.provider || 'youtube',
    videoId: item.videoId,
    title: item.title,
    channel: item.channel,
    channelId: item.channelId,
    channelHandle: item.channelHandle || null,
    description: item.description || '',
    publishedAt: item.publishedAt || null,
    duration: item.duration || '',
    viewCount: Number(item.viewCount) || 0,
    thumbnailUrl: item.thumbnailUrl || null,
    sortBucket: item.sortBucket || undefined,
    sortBuckets: Array.isArray(item.sortBuckets) ? item.sortBuckets : undefined,
    fetchedAt: item.fetchedAt,
  };
}

export async function listYoutubeVideoRows() {
  const result = await queryKysely(
    `
      SELECT ${YOUTUBE_ROW_COLUMNS}
      FROM youtube_videos
      ORDER BY position ASC
    `,
  );
  return result.rows.map(rowToYoutubeItem).filter(Boolean);
}

export async function queryPublicYoutubeRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const params = [];
  const where = [];
  const channel = cleanText(options.channel).toLowerCase();
  if (channel) {
    params.push(`%${channel}%`);
    where.push(`lower(COALESCE(channel, '')) LIKE $${params.length}`);
  }
  const handles = sqlStringList(options.channelHandles).map((handle) => handle.toLowerCase());
  if (handles.length > 0) {
    params.push(handles);
    where.push(`lower(COALESCE(channel_handle, '')) = ANY($${params.length}::text[])`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(title, '')) LIKE $${params.length}
      OR lower(COALESCE(description, '')) LIKE $${params.length}
      OR lower(COALESCE(channel, '')) LIKE $${params.length}
    )`);
  }
  const sort = cleanText(options.sort) === 'popular' ? 'popular' : 'latest';
  const popularBucketClause = (paramIndex) => `(
    sort_bucket = $${paramIndex}
    OR $${paramIndex} = ANY(sort_buckets)
  )`;
  let finalWhere = where;
  let finalParams = [...params];
  if (sort === 'popular') {
    const bucketParams = [...params, sort];
    const bucketWhere = [...where, popularBucketClause(bucketParams.length)];
    const bucketExists = await queryKysely(
      `
        SELECT 1
        FROM youtube_videos
        ${bucketWhere.length ? `WHERE ${bucketWhere.join(' AND ')}` : ''}
        LIMIT 1
      `,
      bucketParams,
    );
    finalWhere = bucketExists.rows.length > 0 ? bucketWhere : where;
    finalParams = bucketExists.rows.length > 0 ? bucketParams : [...params];
  }
  finalParams.push(limit + 1, offset);
  const order = sort === 'popular'
    ? 'ORDER BY view_count DESC, published_at DESC NULLS LAST'
    : 'ORDER BY published_at DESC NULLS LAST, fetched_at DESC NULLS LAST, id DESC';
  const result = await queryKysely(
    `
      SELECT ${YOUTUBE_ROW_COLUMNS}
      FROM youtube_videos
      ${finalWhere.length ? `WHERE ${finalWhere.join(' AND ')}` : ''}
      ${order}
      LIMIT $${finalParams.length - 1} OFFSET $${finalParams.length}
    `,
    finalParams,
  );
  return paginatedSqlRows(
    result.rows.map((row) => {
      const item = rowToYoutubeItem(row);
      return { ...row, item: item ? publicYoutube(item) : null };
    }),
    { limit, offset },
  );
}

export async function queryPublicYoutubeChannelRows() {
  const settingsResult = await queryKysely(`SELECT payload FROM app_settings WHERE id = 'app'`);
  const appSettings = payloadFromRow(settingsResult.rows[0]) || {};
  const catalog = ensureYoutubeChannelsCatalog(appSettings)
    .filter((c) => c && c.hidden !== true && c.enabled !== false)
    .map((c, idx) => {
      const handle = normalizeYoutubeHandle(c.handle || c.id);
      return {
        handle,
        key: handle.toLowerCase(),
        title: cleanText(c.title) || (handle ? `@${handle}` : ''),
        order: Number(c.order) || idx + 1,
      };
    })
    .filter((c) => c.handle);

  const configuredKeys = new Set(catalog.map((c) => c.key).filter(Boolean));
  const where = [`COALESCE(channel_handle, '') <> ''`];
  const params = [];
  if (configuredKeys.size > 0) {
    params.push([...configuredKeys]);
    where.push(`lower(COALESCE(channel_handle, '')) = ANY($${params.length}::text[])`);
  }

  const result = await queryKysely(
    `
      SELECT
        lower(COALESCE(channel_handle, '')) AS handle_key,
        (array_agg(COALESCE(channel_handle, '') ORDER BY published_at DESC NULLS LAST))[1] AS handle,
        (array_agg(COALESCE(channel, '') ORDER BY published_at DESC NULLS LAST))[1] AS title,
        COUNT(*)::int AS count,
        MAX(published_at) AS latest_at
      FROM youtube_videos
      WHERE ${where.join(' AND ')}
      GROUP BY lower(COALESCE(channel_handle, ''))
      ORDER BY MAX(published_at) DESC NULLS LAST
    `,
    params,
  );

  const statsByHandle = new Map(
    result.rows
      .map((row) => {
        const key = cleanText(row.handle_key).toLowerCase();
        if (!key) return null;
        return [key, row];
      })
      .filter(Boolean),
  );

  if (catalog.length > 0) {
    return catalog
      .map((c) => {
        const stats = statsByHandle.get(c.key) || {};
        return {
          handle: c.handle,
          title: cleanText(stats.title) || c.title || `@${c.handle}`,
          count: Number(stats.count) || 0,
          latestAt: stats.latest_at || null,
          order: c.order,
          configured: true,
        };
      })
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  return result.rows
    .map((row, idx) => {
      const handle = normalizeYoutubeHandle(row.handle);
      if (!handle) return null;
      return {
        handle,
        title: cleanText(row.title) || `@${handle}`,
        count: Number(row.count) || 0,
        latestAt: row.latest_at || null,
        order: idx + 1,
        configured: false,
      };
    })
    .filter(Boolean);
}
