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

const NAVER_CAFE_CLUB_IDS = {
  naver_likeusstock_free: '28497937',
  naver_yamizal_free: '30676048',
};

function naverCafeMobileUrl(source, articleId) {
  const clubId = NAVER_CAFE_CLUB_IDS[source];
  const id = cleanText(articleId);
  return clubId && id ? `https://m.cafe.naver.com/ca-fe/web/cafes/${clubId}/articles/${id}` : null;
}

function publicSourceUrl(row) {
  const raw = cleanText(row?.source_url);
  if (row?.source && NAVER_CAFE_CLUB_IDS[row.source]) {
    if (!raw) return naverCafeMobileUrl(row.source, row?.provider_item_id);
    try {
      const parsed = new URL(raw);
      const articleId = parsed.searchParams.get('articleid') || parsed.pathname.match(/\/articles\/([^/?#]+)/)?.[1];
      return naverCafeMobileUrl(row.source, articleId || row?.provider_item_id) || raw;
    } catch {
      return naverCafeMobileUrl(row.source, row?.provider_item_id) || raw;
    }
  }
  return raw || null;
}

function publicCommunityPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    provider: row.provider || null,
    title: row.title || '',
    body: row.body || '',
    sourceUrl: publicSourceUrl(row),
    publishedAt: parseToUtcIsoOrNull(row.published_at),
    fetchedAt: parseToUtcIsoOrNull(row.fetched_at),
    updatedAt: parseToUtcIsoOrNull(row.updated_at),
  };
}

export const COMMUNITY_SOURCES = [
  'naver_likeusstock_free',
  'naver_yamizal_free',
  'motley_fool_investing',
];

/** Drop rows for `source` that were not in the latest ingest window. */
export async function pruneCommunityPostsForSource(source, providerItemIds = []) {
  const cleanSource = cleanText(source);
  if (!cleanSource) return { deleted: 0 };
  const keepIds = [...new Set((providerItemIds || []).map((id) => cleanText(id)).filter(Boolean))];
  if (keepIds.length === 0) return { deleted: 0 };

  const result = await queryKysely(
    `
      DELETE FROM community_posts
      WHERE source = $1
        AND NOT (provider_item_id = ANY($2::text[]))
    `,
    [cleanSource, keepIds],
  );
  return { deleted: Number(result.rowCount) || 0 };
}

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

export async function queryPublicCommunityPostByIdRow(id) {
  const key = cleanText(id);
  if (!key) return null;
  const result = await queryKysely(
    `
      SELECT ${ROW_COLUMNS}
      FROM community_posts
      WHERE id = $1
      LIMIT 1
    `,
    [key],
  );
  return publicCommunityPost(result.rows[0]);
}
