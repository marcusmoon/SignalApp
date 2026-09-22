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
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    count: Number(item.count) || 0,
    generatedDate: item.generatedDate || null,
    generatedAt: item.generatedAt || null,
    primaryNewsId: item.primaryNewsId || null,
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    aiGenerated: item.aiGenerated === true,
    storyId: item.storyId || null,
    revisionId: item.revisionId || null,
    previousDigestId: item.previousDigestId || null,
    changeType: item.changeType || null,
    changes: Array.isArray(item.changes) ? item.changes : [],
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
  const storyId = cleanText(options.storyId);
  if (storyId) {
    params.push(storyId);
    where.push(`payload->>'storyId' = $${params.length}`);
  }
  const symbols = cleanText(options.symbols).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 50);
  if (symbols.length) {
    const aliases = [...new Set(symbols.flatMap((s) => {
      const key = s.replace(/^KRX:/, '').replace(/\.(KS|KQ)$/, '');
      return /^\d{6}$/.test(key) ? [key, `${key}.KS`, `${key}.KQ`, `KRX:${key}`] : [key];
    }))];
    params.push(aliases);
    where.push(`(payload->'symbols') ?| $${params.length}::text[]`);
  }
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
  // A story or watchlist lookup spans runs. v3 default feeds keep the latest
  // revision per story, so a partial run does not erase other recent stories.
  const allRuns = Boolean(storyId || symbols.length);
  const recentV3 = from || to ? 'TRUE' : "f.generated_at >= now() - interval '24 hours'";
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
      , candidates AS (
      SELECT f.*, ROW_NUMBER() OVER (
        PARTITION BY COALESCE(f.payload->>'storyId', f.id)
        ORDER BY f.generated_at DESC, (f.payload->>'revisionNumber')::int DESC NULLS LAST, f.id DESC
      ) AS story_rank
      FROM filtered f
      JOIN ranked_runs r
        ON f.category IS NOT DISTINCT FROM r.category
        AND f.digest_date IS NOT DISTINCT FROM r.digest_date
        AND f.generated_at IS NOT DISTINCT FROM r.generated_at
      WHERE ${allRuns ? 'TRUE' : `(r.run_rank <= $${params.length - 2} OR (f.payload->>'storyId' IS NOT NULL AND ${recentV3}))`}
      )
      SELECT payload FROM candidates
      WHERE ${storyId ? 'TRUE' : 'story_rank = 1'}
        AND $${params.length - 2}::int >= 1
      ORDER BY generated_at DESC NULLS LAST, digest_date DESC NULLS LAST, score DESC NULLS LAST, position ASC, id ASC
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
