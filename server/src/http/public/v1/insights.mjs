import { queryInsightItems } from '../../../db.mjs';
import { normalizeInsightDisplayKey } from '../../../db/insights.mjs';
import { json } from '../../shared.mjs';

function utcTodayRange() {
  const now = new Date();
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString(),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString(),
  };
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function dateOnlyToUtcRange(value) {
  const [year, month, day] = String(value || '').split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return {
    from: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString(),
    to: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString(),
  };
}

function insightLogicalKey(item) {
  return normalizeInsightDisplayKey(item);
}

function newestLogicalInsights(rows) {
  const latestFirst = [...rows].sort(
    (a, b) =>
      String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
      Number(b.score || 0) - Number(a.score || 0),
  );
  const seen = new Set();
  const out = [];
  for (const item of latestFirst) {
    const key = insightLogicalKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function insightRequestParams(url) {
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const symbolsParam = url.searchParams.get('symbols') || '';
  const symbols = new Set(
    [symbol, ...symbolsParam.split(',')]
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean),
  );
  const level = url.searchParams.get('level')?.trim();
  const kind = url.searchParams.get('kind')?.trim();
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const dateRaw = url.searchParams.get('date');
  const dateMode = String(dateRaw || 'all').toLowerCase();
  const pushOnly = url.searchParams.get('pushCandidate') === 'true';
  const history = url.searchParams.get('history') === 'true';
  const dateRange = isDateOnly(dateRaw)
    ? dateOnlyToUtcRange(dateRaw)
    : dateMode === 'today'
      ? utcTodayRange()
      : null;
  const from = fromRaw || dateRange?.from || '';
  const to = toRaw || dateRange?.to || '';
  return {
    symbol,
    symbols,
    level,
    kind,
    from,
    to,
    dateMode,
    pushOnly,
    history,
    queryFrom: from,
    queryTo: to,
  };
}

function filterInsights(items, params) {
  const now = Date.now();
  let rows = [...(items || [])];
  rows = rows.filter((item) => {
    const expiresAt = item?.expiresAt ? new Date(item.expiresAt).getTime() : null;
    return !Number.isFinite(expiresAt) || expiresAt >= now;
  });
  if (params.from) {
    const fromMs = new Date(params.from).getTime();
    if (Number.isFinite(fromMs)) rows = rows.filter((item) => !item.generatedAt || new Date(item.generatedAt).getTime() >= fromMs);
  }
  if (params.to) {
    const toMs = new Date(params.to).getTime();
    if (Number.isFinite(toMs)) rows = rows.filter((item) => !item.generatedAt || new Date(item.generatedAt).getTime() <= toMs);
  }
  if (params.symbols?.size > 0)
    rows = rows.filter((item) => (item.symbols || []).some((s) => params.symbols.has(String(s).toUpperCase())));
  if (params.level) rows = rows.filter((item) => item.level === params.level);
  if (params.kind) rows = rows.filter((item) => item.kind === params.kind);
  if (params.pushOnly) rows = rows.filter((item) => item.pushCandidate === true);
  if (!params.history) rows = newestLogicalInsights(rows);
  return rows.sort(
    (a, b) =>
      Number(b.score || 0) - Number(a.score || 0) ||
      String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')),
  );
}

function publicInsight(item) {
  return {
    id: item.id,
    kind: item.kind,
    level: item.level,
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
    title: item.title || '',
    summary: item.summary || '',
    whyNow: item.whyNow || '',
    actionLabel: item.actionLabel || '',
    signalDrivers: Array.isArray(item.signalDrivers) ? item.signalDrivers : [],
    sourceStats: item.sourceStats && typeof item.sourceStats === 'object' ? item.sourceStats : null,
    nextSteps: Array.isArray(item.nextSteps) ? item.nextSteps : [],
    priceMovePercent: Number.isFinite(Number(item.priceMovePercent)) ? Number(item.priceMovePercent) : null,
    earningsDate: item.earningsDate || null,
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    topics: Array.isArray(item.topics) ? item.topics : [],
    reasoning: Array.isArray(item.reasoning) ? item.reasoning : [],
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    pushCandidate: item.pushCandidate === true,
    pushPriority: item.pushPriority || (item.level === 'alert' ? 'high' : item.pushCandidate ? 'normal' : 'none'),
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    generatedAt: item.generatedAt || null,
    expiresAt: item.expiresAt || null,
  };
}

export async function handlePublicInsightRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/insights') {
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 10) || 10), 50);
    const offsetRaw = Number(url.searchParams.get('offset') || 0) || 0;
    const params = insightRequestParams(url);
    const candidates = await queryInsightItems({
      from: params.queryFrom,
      to: params.queryTo,
      kind: params.kind,
      level: params.level,
      pushOnly: params.pushOnly,
    });
    const filtered = filterInsights(candidates, params);
    const total = filtered.length;
    const offset = Math.min(Math.max(0, offsetRaw), total);
    const page = filtered.slice(offset, offset + limit).map(publicInsight);
    const hasMore = offset + page.length < total;
    json(res, 200, {
      data: page,
      meta: { total, limit, offset, hasMore },
    });
    return true;
  }
  return false;
}
