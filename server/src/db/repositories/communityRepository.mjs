import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  parseToUtcIsoOrNull,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';

const ROW_COLUMNS = `
  id, source, provider, provider_item_id, title, body, source_url,
  published_at, fetched_at, updated_at
`;

function publicCommunityPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    provider: row.provider || null,
    title: row.title || '',
    body: row.body || '',
    sourceUrl: row.source_url || null,
    publishedAt: parseToUtcIsoOrNull(row.published_at),
    fetchedAt: parseToUtcIsoOrNull(row.fetched_at),
    updatedAt: parseToUtcIsoOrNull(row.updated_at),
  };
}

export const COMMUNITY_SOURCES = ['naver_likeusstock_free', 'save_user_news'];

export async function queryPublicCommunityRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const params = [];
  const where = [];
  const source = cleanText(options.source);
  const q = cleanText(options.q);

  if (source && source !== 'all') {
    params.push(source);
    where.push(`source = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR body ILIKE $${params.length})`);
  }
  const from = sqlUtcRangeFrom(options.from);
  if (from) {
    params.push(from);
    where.push(`published_at >= $${params.length}::timestamptz`);
  }
  const to = sqlUtcRangeTo(options.to);
  if (to) {
    params.push(to);
    where.push(`published_at <= $${params.length}::timestamptz`);
  }

  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT ${ROW_COLUMNS}
      FROM community_posts
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY published_at DESC NULLS LAST, updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(publicCommunityPost).filter(Boolean);
  const pageRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    rows: pageRows,
    total: offset + pageRows.length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + pageRows.length : null,
  };
}
