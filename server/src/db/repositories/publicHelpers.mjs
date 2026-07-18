import {
  isDateOnly,
  parseToUtcIsoOrNull,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
  utcDateOnlyOrNull,
  utcDateKeyFromInstant,
} from '../../time/utc.mjs';

export function cleanText(value) {
  return String(value || '').trim();
}

/**
 * 본문 name↔Yahoo symbol 매핑. name은 본문 표기와 정확히 일치해야 함.
 * @returns {{ name: string, symbol: string }[]}
 */
export function normalizeEntities(input, { limit = 40 } = {}) {
  const raw = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const name = cleanText(row.name);
    const symbol = cleanText(row.symbol);
    if (!name || !symbol) continue;
    const key = `${name}\u0000${symbol.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, symbol });
    if (out.length >= limit) break;
  }
  return out;
}

export function safeLimit(value, fallback = 30, max = 100) {
  return Math.min(max, Math.max(1, Math.floor(Number(value)) || fallback));
}

export function safeOffset(value) {
  return Math.max(0, Math.floor(Number(value)) || 0);
}

export function pageOptions(options = {}, defaultLimit = 30) {
  const limit = safeLimit(options.limit ?? options.pageSize, defaultLimit, 100);
  const page = Math.max(1, Math.floor(Number(options.page)) || 1);
  const offset = options.offset != null && cleanText(options.offset) !== '' ? safeOffset(options.offset) : (page - 1) * limit;
  return { limit, offset };
}

export function payloadFromRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return payload && typeof payload === 'object' ? payload : null;
}

export function sqlStringList(value) {
  return cleanText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sqlDateOrTimestamp(value) {
  return sqlUtcRangeFrom(value);
}

export function sqlUtcRangeEnd(value) {
  return sqlUtcRangeTo(value);
}

export { isDateOnly, parseToUtcIsoOrNull, sqlUtcRangeFrom, sqlUtcRangeTo, utcDateOnlyOrNull, utcDateKeyFromInstant };

export function numberSqlExpression(jsonExpression) {
  return `CASE WHEN NULLIF(${jsonExpression}, '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${jsonExpression})::numeric ELSE 0 END`;
}

export function paginatedSqlRows(rows, { limit, offset }) {
  const hasLookahead = rows.length > limit;
  const slice = rows.slice(0, limit).map((row) => row.item).filter(Boolean);
  const exactTotal = Number(rows[0]?.total_count);
  const total = Number.isFinite(exactTotal) && exactTotal > 0
    ? exactTotal
    : offset + slice.length + (hasLookahead ? 1 : 0);
  return {
    rows: slice,
    total,
    limit,
    offset,
    hasMore: hasLookahead || offset + slice.length < total,
    nextOffset: hasLookahead || offset + slice.length < total ? offset + slice.length : null,
  };
}
