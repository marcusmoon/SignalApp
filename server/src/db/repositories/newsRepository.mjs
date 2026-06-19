import { queryKysely } from '../kysely/client.mjs';
import {
  cleanNewsTitleForDisplay,
  cleanTranslationText,
  displayNews,
  hasUsableTranslation,
} from '../../http/shared.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlDateOrTimestamp,
  sqlStringList,
} from './publicHelpers.mjs';

function publicNews(item) {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    summary: item.summary,
    originalTitle: item.originalTitle,
    originalSummary: item.originalSummary,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    imageUrl: item.imageUrl || null,
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    provider: item.provider,
    publishedAt: item.publishedAt || null,
    fetchedAt: item.fetchedAt,
  };
}

export async function queryPublicNewsRows(options = {}) {
  const { limit, offset } = pageOptions(options, 20);
  const locale = cleanText(options.locale) || 'ko';
  const params = [locale];
  const where = [];
  const category = cleanText(options.category);
  if (category) {
    if (category === 'global') {
      where.push(`(n.category = 'global' OR n.provider = 'financialjuice')`);
    } else {
      params.push(category);
      where.push(`n.category = $${params.length}`);
    }
  }
  const symbols = new Set([
    ...sqlStringList(options.symbols).map((s) => s.toUpperCase()),
    ...(cleanText(options.symbol) ? [cleanText(options.symbol).toUpperCase()] : []),
  ]);
  if (symbols.size > 0) {
    params.push([...symbols]);
    where.push(`COALESCE(n.payload->'symbols', '[]'::jsonb) ?| $${params.length}::text[]`);
  }
  const sources = sqlStringList(options.sources || options.source);
  if (sources.length > 0) {
    params.push(sources);
    where.push(`n.source_name = ANY($${params.length}::text[])`);
  }
  const from = sqlDateOrTimestamp(options.from);
  if (from) {
    params.push(from);
    where.push(`(n.published_at IS NULL OR n.published_at >= $${params.length}::timestamptz)`);
  }
  const rawTo = cleanText(options.to);
  const to = sqlDateOrTimestamp(rawTo);
  if (to) {
    params.push(rawTo.includes('T') ? to : `${rawTo.slice(0, 10)}T23:59:59.999Z`);
    where.push(`(n.published_at IS NULL OR n.published_at <= $${params.length}::timestamptz)`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(n.payload->>'titleOriginal', '')) LIKE $${params.length}
      OR lower(COALESCE(n.payload->>'summaryOriginal', '')) LIKE $${params.length}
      OR lower(COALESCE(n.source_name, '')) LIKE $${params.length}
    )`);
  }
  const tag = cleanText(options.tag).toLowerCase();
  if (tag) {
    params.push(tag);
    where.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(n.payload->'hashtags', '[]'::jsonb)) AS h(value)
      WHERE lower(COALESCE(h.value->>'label', '')) = $${params.length}
    )`);
  }
  const flash = ['1', 'true', 'yes'].includes(cleanText(options.flash).toLowerCase());
  if (flash) {
    where.push(`(
      n.published_at >= now() - interval '18 minutes'
      OR n.category IN ('breaking', 'flash', 'hot')
      OR COALESCE(n.payload->>'titleOriginal', n.payload->>'title', '') ~* 'breaking|flash|속보|긴급|urgent|live\\s*:|market\\s*alert|just\\s*in|developing|exclusive:'
    )`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT n.payload, t.payload AS translation_payload
      FROM news_items n
      LEFT JOIN news_translations t ON t.news_item_id = n.id AND t.locale = $1
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY n.published_at DESC NULLS LAST, n.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows
    .map((row) => {
      const item = payloadFromRow(row);
      const translation = payloadFromRow({ payload: row.translation_payload });
      if (!item) return null;
      return publicNews(displayNews(item, translation ? [translation] : [], locale));
    })
    .filter(Boolean);
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

export async function queryPublicNewsSourceRows(options = {}) {
  const category = cleanText(options.category);
  const params = [];
  const where = ['enabled = true', 'hidden = false'];
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  const result = await queryKysely(
    `
      SELECT payload
      FROM news_sources
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(name, source_key), position ASC
    `,
    params,
  );
  return result.rows
    .map(payloadFromRow)
    .filter(Boolean)
    .map((source) => ({
      id: source.id,
      name: source.name || source.id,
      category: source.category || 'global',
      enabled: source.enabled !== false,
      order: Number(source.order) || 0,
    }));
}

export async function queryAdminNewsRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const locale = cleanText(options.locale) || 'ko';
  const params = [locale];
  const where = [];
  const category = cleanText(options.category);
  if (category) {
    if (category === 'global') {
      where.push(`(n.category = 'global' OR n.provider = 'financialjuice')`);
    } else {
      params.push(category);
      where.push(`n.category = $${params.length}`);
    }
  }
  const symbols = new Set([
    ...sqlStringList(options.symbols).map((s) => s.toUpperCase()),
    ...(cleanText(options.symbol) ? [cleanText(options.symbol).toUpperCase()] : []),
  ]);
  if (symbols.size > 0) {
    params.push([...symbols]);
    where.push(`COALESCE(n.payload->'symbols', '[]'::jsonb) ?| $${params.length}::text[]`);
  }
  const sources = sqlStringList(options.sources || options.source);
  if (sources.length > 0) {
    params.push(sources);
    where.push(`n.source_name = ANY($${params.length}::text[])`);
  }
  const from = sqlDateOrTimestamp(options.from);
  if (from) {
    params.push(from);
    where.push(`(n.published_at IS NULL OR n.published_at >= $${params.length}::timestamptz)`);
  }
  const rawTo = cleanText(options.to);
  const to = sqlDateOrTimestamp(rawTo);
  if (to) {
    params.push(rawTo.includes('T') ? to : `${rawTo.slice(0, 10)}T23:59:59.999Z`);
    where.push(`(n.published_at IS NULL OR n.published_at <= $${params.length}::timestamptz)`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(n.payload->>'titleOriginal', '')) LIKE $${params.length}
      OR lower(COALESCE(n.payload->>'summaryOriginal', '')) LIKE $${params.length}
      OR lower(COALESCE(n.source_name, '')) LIKE $${params.length}
    )`);
  }
  const tag = cleanText(options.tag).toLowerCase();
  if (tag) {
    params.push(tag);
    where.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(n.payload->'hashtags', '[]'::jsonb)) AS h(value)
      WHERE lower(COALESCE(h.value->>'label', '')) = $${params.length}
    )`);
  }
  const flash = ['1', 'true', 'yes'].includes(cleanText(options.flash).toLowerCase());
  if (flash) {
    where.push(`(
      n.published_at >= now() - interval '18 minutes'
      OR n.category IN ('breaking', 'flash', 'hot')
      OR COALESCE(n.payload->>'titleOriginal', n.payload->>'title', '') ~* 'breaking|flash|속보|긴급|urgent|live\\s*:|market\\s*alert|just\\s*in|developing|exclusive:'
    )`);
  }
  const translationStatus = cleanText(options.translationStatus);
  if (translationStatus === 'missing') {
    where.push(`(t_locale.id IS NULL OR t_locale.status NOT IN ('completed', 'manual') OR t_locale.payload->>'provider' = 'mock')`);
  } else if (translationStatus) {
    params.push(translationStatus);
    where.push(`t_locale.status = $${params.length}`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT
        n.payload,
        COALESCE(jsonb_agg(t_all.payload ORDER BY t_all.locale) FILTER (WHERE t_all.id IS NOT NULL), '[]'::jsonb) AS translations_payload
      FROM news_items n
      LEFT JOIN news_translations t_locale ON t_locale.news_item_id = n.id AND t_locale.locale = $1
      LEFT JOIN news_translations t_all ON t_all.news_item_id = n.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY n.id, n.payload, n.published_at, n.position
      ORDER BY n.published_at DESC NULLS LAST, n.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows
    .slice(0, limit)
    .map((row) => {
      const item = payloadFromRow(row);
      if (!item) return null;
      const translations = Array.isArray(row.translations_payload) ? row.translations_payload : [];
      return {
        ...displayNews(item, translations, locale),
        hashtagSource: String(item.hashtagSource || 'auto') === 'manual' ? 'manual' : 'auto',
        hashtagUpdatedAt: item.hashtagsUpdatedAt || null,
        translations: translations.map((t) => ({
          ...t,
          title: cleanNewsTitleForDisplay(item, t.title),
          summary: cleanTranslationText(t.summary),
          content: cleanTranslationText(t.content),
          status: hasUsableTranslation(t, item) ? t.status : 'missing',
        })),
      };
    })
    .filter(Boolean);
  const hasMore = result.rows.length > limit;
  return {
    rows,
    total: offset + rows.length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
  };
}
