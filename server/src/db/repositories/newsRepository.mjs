import { queryKysely } from '../kysely/client.mjs';
import {
  cleanNewsTitleForDisplay,
  cleanTranslationText,
  displayNews,
  resolveAlternateTitle,
} from '../../http/shared.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlDateOrTimestamp,
  sqlStringList,
} from './publicHelpers.mjs';

function sqlPendingTranslation(alias) {
  return `(${alias}.id IS NULL OR ${alias}.status NOT IN ('completed', 'manual'))`;
}

function publicNews(item, translations, locale) {
  const displayed = displayNews(item, translations, locale);
  const alternateTitle = resolveAlternateTitle(item, translations, locale, displayed);
  return {
    id: displayed.id,
    category: displayed.category,
    title: displayed.title,
    summary: displayed.summary,
    originalTitle: displayed.originalTitle,
    originalSummary: displayed.originalSummary,
    alternateTitle: alternateTitle || undefined,
    sourceName: displayed.sourceName,
    sourceUrl: displayed.sourceUrl,
    imageUrl: displayed.imageUrl || null,
    symbols: Array.isArray(displayed.symbols) ? displayed.symbols : [],
    hashtags: Array.isArray(displayed.hashtags) ? displayed.hashtags : [],
    provider: displayed.provider,
    publishedAt: displayed.publishedAt || null,
    fetchedAt: displayed.fetchedAt,
  };
}

function canonicalNewsUrl(raw) {
  const value = cleanText(raw);
  if (!value) return '';
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|xy$|oc$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    const query = url.searchParams.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`.toLowerCase();
  } catch {
    return value.replace(/[?#].*$/, '').toLowerCase();
  }
}

function newsDedupeKey(item) {
  const url = canonicalNewsUrl(item?.sourceUrl);
  if (url) return url;
  const title = cleanText(item?.originalTitle || item?.title).toLowerCase().replace(/\s+/g, ' ').trim();
  const source = cleanText(item?.sourceName).toLowerCase();
  return `${source}:${title}`;
}

function dedupePublicNewsRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = newsDedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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
      SELECT n.payload, t.payload AS translation_payload, t_ko.payload AS ko_translation_payload
      FROM news_items n
      LEFT JOIN news_translations t ON t.news_item_id = n.id AND t.locale = $1
      LEFT JOIN news_translations t_ko ON t_ko.news_item_id = n.id AND t_ko.locale = 'ko' AND $1 = 'en'
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
      const koTranslation = payloadFromRow({ payload: row.ko_translation_payload });
      if (!item) return null;
      const translations = [translation, koTranslation].filter(Boolean);
      return publicNews(item, translations, locale);
    })
    .filter(Boolean);
  const hasMore = rows.length > limit;
  const pageRows = dedupePublicNewsRows(rows).slice(0, limit);
  return {
    rows: pageRows,
    total: offset + rows.slice(0, limit).length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
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

function pendingNewsTranslationRow(item, targetLocale) {
  return {
    id: item.id,
    category: item.category,
    titleOriginal: item.titleOriginal || item.title || '',
    summaryOriginal: item.summaryOriginal || item.summary || '',
    contentOriginal: item.contentOriginal || item.summaryOriginal || item.summary || '',
    sourceName: item.sourceName || '',
    sourceUrl: item.sourceUrl || '',
    imageUrl: item.imageUrl || null,
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    publishedAt: item.publishedAt || null,
    targetLocale,
  };
}

function buildPendingNewsTranslationFilters(options = {}, targetLocale) {
  const params = [targetLocale];
  const where = [sqlPendingTranslation('t_target')];
  const category = cleanText(options.category);
  if (category) {
    if (category === 'global') {
      where.push(`(n.category = 'global' OR n.provider = 'financialjuice')`);
    } else {
      params.push(category);
      where.push(`n.category = $${params.length}`);
    }
  }
  const from = sqlDateOrTimestamp(options.from);
  if (from) {
    params.push(from);
    where.push(`(n.published_at IS NULL OR n.published_at >= $${params.length}::timestamptz)`);
  }
  return { params, where };
}

export async function findNewsItemIds(ids = []) {
  const safeIds = [...new Set(ids.map((id) => cleanText(id)).filter(Boolean))];
  if (safeIds.length === 0) return new Set();
  const result = await queryKysely(
    `SELECT id FROM news_items WHERE id = ANY($1::text[])`,
    [safeIds],
  );
  return new Set(result.rows.map((row) => row.id));
}

export async function queryPendingNewsTranslationRows(options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const targetLocale = cleanText(options.targetLocale) || 'ko';
  const { params, where } = buildPendingNewsTranslationFilters(options, targetLocale);
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT n.payload
      FROM news_items n
      LEFT JOIN news_translations t_target ON t_target.news_item_id = n.id AND t_target.locale = $1
      WHERE ${where.join(' AND ')}
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
      return pendingNewsTranslationRow(item, targetLocale);
    })
    .filter(Boolean);

  const hasMore = result.rows.length > limit;
  return {
    rows,
    total: offset + rows.length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
    targetLocale,
  };
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
    where.push(sqlPendingTranslation('t_locale'));
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
