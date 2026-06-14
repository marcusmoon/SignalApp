import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
} from './publicHelpers.mjs';

function publicBriefing(item) {
  if (!item) return null;
  return {
    id: item.id,
    market: item.market || '',
    session: item.session || '',
    title: item.title || '',
    headline: item.headline || '',
    summary: item.summary || '',
    overview: Array.isArray(item.overview) ? item.overview : [],
    companies: Array.isArray(item.companies) ? item.companies : [],
    macro: Array.isArray(item.macro) ? item.macro : [],
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    publishedAt: item.publishedAt || item.generatedAt || null,
    briefingDate: item.briefingDate || item.generatedDate || null,
    pushCandidate: item.pushCandidate === true,
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function queryPublicMarketBriefings(options = {}) {
  const { limit, offset } = pageOptions(options, 10);
  const params = [];
  const where = [];
  const market = cleanText(options.market).toLowerCase();
  const session = cleanText(options.session).toLowerCase();
  const date = cleanText(options.date);
  const id = cleanText(options.id);
  if (id) {
    params.push(id);
    where.push(`id = $${params.length}`);
  }
  if (market) {
    params.push(market);
    where.push(`market = $${params.length}`);
  }
  if (session) {
    params.push(session);
    where.push(`session = $${params.length}`);
  }
  if (date) {
    params.push(date);
    where.push(`briefing_date = $${params.length}::date`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM market_briefings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY briefing_date DESC, published_at DESC, position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicBriefing);
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

export async function getPublicMarketBriefing(id) {
  const rows = await queryPublicMarketBriefings({ id, limit: 1, offset: 0 });
  return rows.rows[0] || null;
}
