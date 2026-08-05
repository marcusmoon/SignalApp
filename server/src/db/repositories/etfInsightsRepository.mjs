import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';
import {
  fetchSymbolProfilesByKeys,
  resolvePublicSymbolMeta,
  symbolProfileLookupKeys,
} from './symbolProfilesRepository.mjs';

function publicEtfInsight(item) {
  if (!item) return null;
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
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function flowSymbol(row) {
  if (!row || typeof row !== 'object') return '';
  return cleanText(row.etf || row.symbol);
}

function heatmapSymbol(row) {
  if (!row || typeof row !== 'object') return '';
  return cleanText(row.etf || row.symbol || row.ticker);
}

async function enrichEtfInsightRows(rows = []) {
  const keys = [
    ...new Set(
      rows.flatMap((insight) => {
        const flowKeys = (insight.flowHighlights || []).flatMap((row) => {
          const symbol = flowSymbol(row);
          return symbol ? symbolProfileLookupKeys({ symbol, displaySymbol: symbol }) : [];
        });
        const heatKeys = (insight.heatmap || []).flatMap((row) => {
          const symbol = heatmapSymbol(row);
          return symbol ? symbolProfileLookupKeys({ symbol, displaySymbol: symbol }) : [];
        });
        return [...flowKeys, ...heatKeys];
      }),
    ),
  ];
  if (keys.length === 0) return rows;
  const profiles = await fetchSymbolProfilesByKeys(keys);
  return rows.map((insight) => ({
    ...insight,
    flowHighlights: (insight.flowHighlights || []).map((row) => {
      if (!row || typeof row !== 'object') return row;
      const symbol = flowSymbol(row);
      if (!symbol) return row;
      const profile = symbolProfileLookupKeys({ symbol, displaySymbol: symbol })
        .map((key) => profiles.get(key))
        .find(Boolean) || null;
      return {
        ...row,
        symbolMeta: resolvePublicSymbolMeta({ symbol, displaySymbol: symbol }, profile),
      };
    }),
    heatmap: (insight.heatmap || []).map((row) => {
      if (!row || typeof row !== 'object') return row;
      const symbol = heatmapSymbol(row);
      if (!symbol) return row;
      const profile = symbolProfileLookupKeys({ symbol, displaySymbol: symbol })
        .map((key) => profiles.get(key))
        .find(Boolean) || null;
      return {
        ...row,
        symbolMeta: resolvePublicSymbolMeta({ symbol, displaySymbol: symbol }, profile),
      };
    }),
  }));
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
  const pageRows = await enrichEtfInsightRows(rows.slice(0, limit));
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
