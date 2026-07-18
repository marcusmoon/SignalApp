import { queryKysely } from '../kysely/client.mjs';
import { hydrateTodayBriefingItems } from '../../sources/resolveSourceRefs.mjs';
import {
  cleanText,
  normalizeEntities,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';

function publicTodayBriefing(item) {
  if (!item) return null;
  const entities = normalizeEntities(item.entities);
  return {
    id: item.id,
    locale: item.locale || 'ko',
    title: item.title || '',
    headline: item.headline || '',
    summary: item.summary || '',
    keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
    sections: Array.isArray(item.sections) ? item.sections : [],
    marketSnapshot: item.marketSnapshot && typeof item.marketSnapshot === 'object' ? item.marketSnapshot : null,
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    relatedDigestIds: Array.isArray(item.relatedDigestIds) ? item.relatedDigestIds : [],
    relatedMarketBriefingIds: Array.isArray(item.relatedMarketBriefingIds) ? item.relatedMarketBriefingIds : [],
    ...(entities.length > 0 ? { entities } : {}),
    generatedAt: item.generatedAt || null,
    publishedAt: item.publishedAt || item.generatedAt || null,
    briefingDate: item.briefingDate || item.generatedDate || null,
    status: item.status || 'published',
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function queryPublicTodayBriefings(options = {}) {
  const { limit, offset } = pageOptions(options, 10);
  const params = [];
  const where = [];
  const locale = cleanText(options.locale || 'ko') || 'ko';
  const date = cleanText(options.date);
  const status = cleanText(options.status || 'published') || 'published';
  const id = cleanText(options.id);

  if (id) {
    params.push(id);
    where.push(`id = $${params.length}`);
  }
  if (locale) {
    params.push(locale);
    where.push(`locale = $${params.length}`);
  }
  if (status !== 'all') {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (date) {
    params.push(date);
    where.push(`briefing_date = $${params.length}::date`);
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
      FROM today_briefings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY briefing_date DESC, published_at DESC, position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicTodayBriefing);
  const hydrated = await hydrateTodayBriefingItems(rows, { locale });
  const pageRows = hydrated.slice(0, limit);
  const hasMore = hydrated.length > limit;
  return {
    rows: pageRows,
    total: offset + pageRows.length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + pageRows.length : null,
  };
}
