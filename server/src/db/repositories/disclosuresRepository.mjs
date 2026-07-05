import { queryKysely } from '../kysely/client.mjs';
import { resolveDisclosureTypeCategory, sortDisclosureTypeCategories } from '../../disclosures/typeCategory.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  sqlDateOrTimestamp,
  sqlStringList,
} from './publicHelpers.mjs';

function publicDisclosure(item) {
  return {
    id: item.id,
    market: item.market || null,
    provider: item.provider || null,
    symbol: item.symbol || null,
    companyName: item.companyName || null,
    formType: item.formType || null,
    typeCategory: resolveDisclosureTypeCategory(item) || null,
    title: item.title || '',
    summary: item.summary || '',
    url: item.url || item.sourceUrl || null,
    filedAt: item.filedAt || null,
    periodEndDate: item.periodEndDate || null,
    fetchedAt: item.fetchedAt || null,
    rawPayload: item.rawPayload || null,
  };
}

function effectiveTypeCategoryExpr() {
  return `COALESCE(NULLIF(type_category, ''), NULLIF(payload->>'typeCategory', ''))`;
}

function buildDisclosureWhere(options = {}, params = []) {
  const where = [];
  const market = cleanText(options.market).toLowerCase();
  if (market) {
    params.push(market);
    where.push(`lower(COALESCE(market, '')) = $${params.length}`);
  }
  const provider = cleanText(options.provider).toLowerCase();
  if (provider) {
    params.push(provider);
    where.push(`lower(COALESCE(provider, '')) = $${params.length}`);
  }
  const formType = cleanText(options.formType).toUpperCase();
  if (formType) {
    params.push(formType);
    where.push(`upper(COALESCE(form_type, '')) = $${params.length}`);
  }
  const typeCategory = cleanText(options.typeCategory);
  if (typeCategory) {
    params.push(typeCategory);
    where.push(`${effectiveTypeCategoryExpr()} = $${params.length}`);
  }
  const symbols = new Set([
    ...sqlStringList(options.symbols).map((s) => s.toUpperCase()),
    ...(cleanText(options.symbol) ? [cleanText(options.symbol).toUpperCase()] : []),
  ]);
  if (symbols.size > 0) {
    params.push([...symbols]);
    where.push(`upper(COALESCE(symbol, '')) = ANY($${params.length}::text[])`);
  }
  const from = sqlDateOrTimestamp(options.from);
  if (from) {
    params.push(from);
    where.push(`(filed_at IS NULL OR filed_at >= $${params.length}::timestamptz)`);
  }
  const rawTo = cleanText(options.to);
  const to = sqlDateOrTimestamp(rawTo);
  if (to) {
    params.push(rawTo.includes('T') ? to : `${rawTo.slice(0, 10)}T23:59:59.999Z`);
    where.push(`(filed_at IS NULL OR filed_at <= $${params.length}::timestamptz)`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(payload->>'title', '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'summary', '')) LIKE $${params.length}
      OR lower(COALESCE(company_name, '')) LIKE $${params.length}
      OR lower(COALESCE(symbol, '')) LIKE $${params.length}
      OR lower(COALESCE(form_type, '')) LIKE $${params.length}
    )`);
  }
  return where;
}

export async function queryPublicDisclosureRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const params = [];
  const where = buildDisclosureWhere(options, params);
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM disclosures
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY filed_at DESC NULLS LAST, position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).map(publicDisclosure);
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

export async function queryPublicDisclosureByIdRow(id) {
  const key = cleanText(id);
  if (!key) return null;
  const result = await queryKysely('SELECT payload FROM disclosures WHERE id = $1 LIMIT 1', [key]);
  const item = payloadFromRow(result.rows[0]);
  return item ? publicDisclosure(item) : null;
}

export async function queryPublicDisclosureTypeCategoryRows(options = {}) {
  const params = [];
  const where = buildDisclosureWhere(options, params);
  where.push(`${effectiveTypeCategoryExpr()} IS NOT NULL`);
  const result = await queryKysely(
    `
      SELECT ${effectiveTypeCategoryExpr()} AS type_category, COUNT(*)::int AS count
      FROM disclosures
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY 1
      ORDER BY count DESC, type_category ASC
    `,
    params,
  );
  const rows = result.rows
    .map((row) => ({
      key: cleanText(row.type_category),
      count: Number(row.count) || 0,
    }))
    .filter((row) => row.key && row.count > 0);
  return {
    rows: sortDisclosureTypeCategories(rows.map((row) => row.key)).map((key) => ({
      key,
      count: rows.find((row) => row.key === key)?.count || 0,
    })),
  };
}
