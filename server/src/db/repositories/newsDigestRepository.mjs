import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlDateOrTimestamp,
} from './publicHelpers.mjs';

function publicDigest(item) {
  return {
    id: item.id,
    category: item.category || 'global',
    title: item.title || '',
    summary: item.summary || '',
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    sources: Array.isArray(item.sources) ? item.sources : [],
    topics: Array.isArray(item.topics) ? item.topics : [],
    count: Number(item.count) || 0,
    score: Number(item.score) || 0,
    generatedDate: item.generatedDate || null,
    generatedAt: item.generatedAt || null,
    primaryNewsId: item.primaryNewsId || null,
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
  };
}

export async function queryPublicNewsDigestRows(options = {}) {
  const { limit, offset } = pageOptions(options, 4);
  const params = [];
  const where = [];
  const category = cleanText(options.category);
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  const from = sqlDateOrTimestamp(options.from);
  if (from) {
    params.push(from);
    where.push(`generated_at >= $${params.length}::timestamptz`);
  }
  const to = sqlDateOrTimestamp(options.to);
  if (to) {
    params.push(to);
    where.push(`generated_at <= $${params.length}::timestamptz`);
  }
  params.push(limit + 1, offset);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queryKysely(
    `
      WITH filtered AS (
        SELECT *
        FROM news_digest_items
        ${whereSql}
      ),
      latest_date AS (
        SELECT category, max(digest_date) AS digest_date
        FROM filtered
        GROUP BY category
      ),
      latest_run AS (
        SELECT f.category, f.digest_date, max(f.generated_at) AS generated_at
        FROM filtered f
        JOIN latest_date d
          ON f.category IS NOT DISTINCT FROM d.category
          AND f.digest_date IS NOT DISTINCT FROM d.digest_date
        GROUP BY f.category, f.digest_date
      )
      SELECT f.payload
      FROM filtered f
      JOIN latest_run r
        ON f.category IS NOT DISTINCT FROM r.category
        AND f.digest_date IS NOT DISTINCT FROM r.digest_date
        AND f.generated_at IS NOT DISTINCT FROM r.generated_at
      ORDER BY f.digest_date DESC NULLS LAST, f.generated_at DESC NULLS LAST, f.score DESC NULLS LAST, f.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicDigest);
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
