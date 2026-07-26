import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';
import { normalizeScreenerMarket, normalizeScreenerMethod } from '../../screener/markets.mjs';
import { SCREENER_DEFAULT_METHOD } from '../../screener/policy.mjs';

function publicSnapshot(item) {
  if (!item) return null;
  return {
    id: item.id,
    market: normalizeScreenerMarket(item.market),
    generatedAt: item.generatedAt || null,
    generatedDate: item.generatedDate || null,
    asOf: item.asOf || null,
    publishedAt: item.publishedAt || null,
    locale: item.locale || 'ko',
    universe: item.universe && typeof item.universe === 'object' ? item.universe : null,
    policy: item.policy && typeof item.policy === 'object' ? item.policy : null,
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function publicRun(item) {
  if (!item) return null;
  return {
    id: item.id,
    market: normalizeScreenerMarket(item.market),
    method: normalizeScreenerMethod(item.method || item.preset),
    status: cleanText(item.status) || 'published',
    generatedAt: item.generatedAt || null,
    generatedDate: item.generatedDate || null,
    publishedAt: item.publishedAt || null,
    locale: item.locale || 'ko',
    title: item.title || '',
    universe: item.universe && typeof item.universe === 'object' ? item.universe : null,
    snapshotAsOf: item.snapshotAsOf || null,
    poolSnapshotId: item.poolSnapshotId || null,
    policy: item.policy && typeof item.policy === 'object' ? item.policy : null,
    items: Array.isArray(item.items) ? item.items : [],
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function queryLatestScreenerSnapshot(market = 'kr') {
  const m = normalizeScreenerMarket(market);
  const result = await queryKysely(
    `
      SELECT payload
      FROM screener_snapshots
      WHERE market = $1
      ORDER BY as_of DESC NULLS LAST, published_at DESC NULLS LAST, position ASC
      LIMIT 1
    `,
    [m],
  );
  return publicSnapshot(payloadFromRow(result.rows[0]));
}

export async function queryScreenerRunByPoolSnapshot({ market, method, poolSnapshotId }) {
  const m = normalizeScreenerMarket(market);
  const meth = normalizeScreenerMethod(method);
  const poolId = cleanText(poolSnapshotId);
  if (!poolId) return null;
  const result = await queryKysely(
    `
      SELECT payload
      FROM screener_runs
      WHERE market = $1
        AND method = $2
        AND payload->>'poolSnapshotId' = $3
      ORDER BY updated_at DESC NULLS LAST, position ASC
      LIMIT 1
    `,
    [m, meth, poolId],
  );
  return publicRun(payloadFromRow(result.rows[0]));
}

export async function queryPublicScreenerRuns(options = {}) {
  const { limit, offset } = pageOptions(options, 10);
  const params = [];
  const where = [];

  const id = cleanText(options.id);
  const market = cleanText(options.market).toLowerCase();
  const method = cleanText(options.method || options.preset).toLowerCase();
  const date = cleanText(options.date);
  // Default published for lists. Pass status:'' for no filter (by-id).
  const hasStatusOption = Object.prototype.hasOwnProperty.call(options, 'status');
  const status = !hasStatusOption ? 'published' : cleanText(options.status).toLowerCase();

  if (id) {
    params.push(id);
    where.push(`id = $${params.length}`);
  }
  if (market) {
    params.push(normalizeScreenerMarket(market));
    where.push(`market = $${params.length}`);
  }
  if (method) {
    params.push(normalizeScreenerMethod(method));
    where.push(`method = $${params.length}`);
  }
  if (date) {
    params.push(date);
    where.push(`generated_date = $${params.length}::date`);
  }
  if (status) {
    params.push(status);
    where.push(`COALESCE(status, payload->>'status', 'published') = $${params.length}`);
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
      SELECT payload
      FROM screener_runs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY generated_date DESC NULLS LAST, published_at DESC NULLS LAST, position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicRun);
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

export async function queryLatestScreenerRun({
  market = 'kr',
  method = SCREENER_DEFAULT_METHOD,
  status = 'published',
} = {}) {
  const page = await queryPublicScreenerRuns({
    market: normalizeScreenerMarket(market),
    method: normalizeScreenerMethod(method),
    status,
    limit: 1,
    offset: 0,
  });
  return page.rows[0] || null;
}
