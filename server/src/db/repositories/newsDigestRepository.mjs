import { queryKysely } from '../kysely/client.mjs';
import { hydrateNewsDigestItems } from '../../sources/resolveSourceRefs.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
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
    generatedDate: item.generatedDate || null,
    generatedAt: item.generatedAt || null,
    primaryNewsId: item.primaryNewsId || null,
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    aiGenerated: item.aiGenerated === true,
  };
}

export async function queryPublicNewsDigestRows(options = {}) {
  const { limit, offset } = pageOptions(options, 4);
  const maxBatches = Math.max(1, Math.min(20, Number(options.batches) || 1));
  const params = [];
  const where = [];
  const id = cleanText(options.id);
  if (id) {
    const byId = await queryKysely('SELECT payload FROM news_digest_items WHERE id = $1 LIMIT 1', [id]);
    const rows = byId.rows.map(payloadFromRow).filter(Boolean).map(publicDigest);
    const hydrated = await hydrateNewsDigestItems(rows, {
      locale: cleanText(options.locale) || 'ko',
    });
    return {
      rows: hydrated,
      total: hydrated.length,
      limit: 1,
      offset: 0,
      hasMore: false,
      nextOffset: null,
    };
  }
  const category = cleanText(options.category);
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  const fromText = cleanText(options.from);
  const from = sqlUtcRangeFrom(fromText);
  if (from) {
    params.push(from);
    where.push(`generated_at >= $${params.length}::timestamptz`);
  }
  const toText = cleanText(options.to);
  const to = sqlUtcRangeTo(toText);
  if (to) {
    params.push(to);
    where.push(`generated_at <= $${params.length}::timestamptz`);
  }
  params.push(maxBatches, limit + 1, offset);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queryKysely(
    `
      WITH filtered AS (
        SELECT *
        FROM news_digest_items
        ${whereSql}
      ),
      runs AS (
        SELECT category, digest_date, generated_at,
          BOOL_OR((payload->>'aiGenerated')::boolean) AS has_ai_generated
        FROM filtered
        GROUP BY category, digest_date, generated_at
      ),
      ranked_runs AS (
        SELECT category, digest_date, generated_at, has_ai_generated,
          DENSE_RANK() OVER (
            PARTITION BY category
            ORDER BY generated_at DESC NULLS LAST, digest_date DESC NULLS LAST, has_ai_generated DESC NULLS LAST
          ) AS run_rank
        FROM runs
      )
      SELECT f.payload
      FROM filtered f
      JOIN ranked_runs r
        ON f.category IS NOT DISTINCT FROM r.category
        AND f.digest_date IS NOT DISTINCT FROM r.digest_date
        AND f.generated_at IS NOT DISTINCT FROM r.generated_at
      WHERE r.run_rank <= $${params.length - 2}
      ORDER BY f.generated_at DESC NULLS LAST, f.digest_date DESC NULLS LAST, f.score DESC NULLS LAST, f.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicDigest);
  const hydrated = await hydrateNewsDigestItems(rows, {
    locale: cleanText(options.locale) || 'ko',
  });
  const pageRows = hydrated.slice(0, limit);
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
