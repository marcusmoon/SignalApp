import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';

function publicSnapshot(item) {
  if (!item) return null;
  return {
    id: item.id,
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
    generatedAt: item.generatedAt || null,
    generatedDate: item.generatedDate || null,
    publishedAt: item.publishedAt || null,
    locale: item.locale || 'ko',
    preset: item.preset || 'fujimoto',
    title: item.title || '',
    universe: item.universe && typeof item.universe === 'object' ? item.universe : null,
    snapshotAsOf: item.snapshotAsOf || null,
    policy: item.policy && typeof item.policy === 'object' ? item.policy : null,
    items: Array.isArray(item.items) ? item.items : [],
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function queryLatestKrScreenerSnapshot() {
  const result = await queryKysely(
    `
      SELECT payload
      FROM kr_screener_snapshots
      ORDER BY as_of DESC NULLS LAST, published_at DESC NULLS LAST, position ASC
      LIMIT 1
    `,
    [],
  );
  return publicSnapshot(payloadFromRow(result.rows[0]));
}

export async function queryPublicKrScreenerRuns(options = {}) {
  const { limit, offset } = pageOptions(options, 10);
  const params = [];
  const where = [];

  const id = cleanText(options.id);
  const preset = cleanText(options.preset).toLowerCase();
  const date = cleanText(options.date);

  if (id) {
    params.push(id);
    where.push(`id = $${params.length}`);
  }
  if (preset) {
    params.push(preset);
    where.push(`preset = $${params.length}`);
  }
  if (date) {
    params.push(date);
    where.push(`generated_date = $${params.length}::date`);
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
      FROM kr_screener_runs
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

export async function queryLatestKrScreenerRun(preset = 'fujimoto') {
  const page = await queryPublicKrScreenerRuns({ preset, limit: 1, offset: 0 });
  return page.rows[0] || null;
}
