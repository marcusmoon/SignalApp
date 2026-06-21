import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlDateOrTimestamp,
} from './publicHelpers.mjs';

function publicDisclosureDigest(item) {
  return {
    id: item.id,
    market: item.market || 'us',
    title: item.title || '',
    summary: item.summary || '',
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    companies: Array.isArray(item.companies) ? item.companies : [],
    forms: Array.isArray(item.forms) ? item.forms : [],
    count: Number(item.count) || 0,
    generatedDate: item.generatedDate || null,
    generatedAt: item.generatedAt || null,
    primaryDisclosureId: item.primaryDisclosureId || null,
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
  };
}

export async function queryPublicDisclosureDigestRows(options = {}) {
  const { limit, offset } = pageOptions(options, 4);
  const maxBatches = Math.max(1, Math.min(20, Number(options.batches) || 1));
  const params = [];
  const where = [];

  const market = cleanText(options.market);
  if (market) {
    params.push(market);
    where.push(`market = $${params.length}`);
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

  params.push(maxBatches, limit + 1, offset);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await queryKysely(
    `
      WITH filtered AS (
        SELECT *
        FROM disclosure_digest_items
        ${whereSql}
      ),
      runs AS (
        SELECT market, digest_date, generated_at
        FROM filtered
        GROUP BY market, digest_date, generated_at
      ),
      ranked_runs AS (
        SELECT market, digest_date, generated_at,
          DENSE_RANK() OVER (
            PARTITION BY market
            ORDER BY digest_date DESC NULLS LAST, generated_at DESC NULLS LAST
          ) AS run_rank
        FROM runs
      )
      SELECT f.payload
      FROM filtered f
      JOIN ranked_runs r
        ON f.market IS NOT DISTINCT FROM r.market
        AND f.digest_date IS NOT DISTINCT FROM r.digest_date
        AND f.generated_at IS NOT DISTINCT FROM r.generated_at
      WHERE r.run_rank <= $${params.length - 2}
      ORDER BY f.digest_date DESC NULLS LAST, f.generated_at DESC NULLS LAST, f.score DESC NULLS LAST, f.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );

  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicDisclosureDigest);
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
