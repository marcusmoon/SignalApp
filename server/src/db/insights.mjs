function parsePayload(label, payload, fallback = null) {
  if (payload == null || payload === '') return fallback;
  try {
    return JSON.parse(payload);
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    wrapped.message = `${wrapped.message} (${label})`;
    throw wrapped;
  }
}

function compactText(value) {
  return String(value || '').trim();
}

function firstSymbol(item) {
  return (Array.isArray(item?.symbols) ? item.symbols : [])
    .map((symbol) => compactText(symbol).toUpperCase())
    .find(Boolean);
}

export function normalizeInsightDisplayKey(item) {
  const kind = compactText(item?.kind) || 'insight';
  if (kind === 'market_brief') return kind;
  const symbol = firstSymbol(item);
  if (kind === 'asset_signal' && symbol) return `${kind}:${symbol}`;
  return compactText(item?.id) || `${kind}:${compactText(item?.title)}`;
}

export function insightGeneratedDate(item) {
  const value = compactText(item?.generatedAt);
  return value.length >= 10 ? value.slice(0, 10) : null;
}

function shiftYmd(value, days) {
  const [year, month, day] = compactText(value).split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function candidateDateBounds({ from, to } = {}) {
  const lowerYmd = from ? shiftYmd(from, -1) : null;
  const upperYmd = to ? shiftYmd(to, 1) : null;
  return {
    generatedFrom: lowerYmd ? `${lowerYmd}T00:00:00.000Z` : null,
    generatedTo: upperYmd ? `${upperYmd}T23:59:59.999Z` : null,
  };
}

export function queryInsightItemsInDb(
  db,
  { from = null, to = null, kind = null, level = null, pushOnly = false, includeExpired = false } = {},
) {
  const where = [];
  const params = [];
  const { generatedFrom, generatedTo } = candidateDateBounds({ from, to });

  if (!includeExpired) {
    where.push("(expires_at IS NULL OR expires_at = '' OR expires_at >= ?)");
    params.push(new Date().toISOString());
  }
  if (generatedFrom) {
    where.push('generated_at >= ?');
    params.push(generatedFrom);
  }
  if (generatedTo) {
    where.push('generated_at <= ?');
    params.push(generatedTo);
  }
  if (kind) {
    where.push('kind = ?');
    params.push(kind);
  }
  if (level) {
    where.push('level = ?');
    params.push(level);
  }
  if (pushOnly) where.push('push_candidate = 1');

  const sql = `
    SELECT payload
    FROM insight_items
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY score DESC, generated_at DESC
  `;

  return db
    .prepare(sql)
    .all(...params)
    .map((row) => parsePayload('insight_items.payload', row.payload, null))
    .filter(Boolean);
}
