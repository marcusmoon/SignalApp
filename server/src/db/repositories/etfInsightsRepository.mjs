import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  normalizeEntities,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';

function publicEtfInsight(item) {
  if (!item) return null;
  const entities = normalizeEntities(item.entities);
  return {
    id: item.id,
    period: item.period || 'daily',
    title: item.title || '',
    summary: item.summary || '',
    insightDate: item.insightDate || null,
    publishedAt: item.publishedAt || null,
    heatmap: Array.isArray(item.heatmap) ? item.heatmap : [],
    themes: Array.isArray(item.themes) ? item.themes : [],
    flowHighlights: Array.isArray(item.flowHighlights) ? item.flowHighlights : [],
    rotation: item.rotation && typeof item.rotation === 'object' ? item.rotation : null,
    insights: Array.isArray(item.insights) ? item.insights : [],
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    ...(entities.length > 0 ? { entities } : {}),
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function queryPublicEtfInsights(options = {}) {
  const { limit, offset } = pageOptions(options, 10);
  const params = [];
  const where = [];

  const id = cleanText(options.id);
  const period = cleanText(options.period).toLowerCase();
  const date = cleanText(options.date);

  if (id) {
    params.push(id);
    where.push(`id = $${params.length}`);
  }
  if (period) {
    params.push(period);
    where.push(`period = $${params.length}`);
  }
  if (date) {
    params.push(date);
    where.push(`insight_date = $${params.length}::date`);
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
      FROM etf_insights
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY insight_date DESC, published_at DESC, position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicEtfInsight);
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
