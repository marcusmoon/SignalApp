import { queryInsightItems } from '../../../db.mjs';
import { normalizeInsightDisplayKey } from '../../../db/insights.mjs';
import { dateKeyInTimeZone, json } from '../../shared.mjs';

function todayInTimeZone(timeZone) {
  return dateKeyInTimeZone(new Date().toISOString(), timeZone);
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
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const timeZone = url.searchParams.get('timeZone') || 'Asia/Seoul';
  const dateMode = String(url.searchParams.get('date') || 'today').toLowerCase();
  const pushOnly = url.searchParams.get('pushCandidate') === 'true';
  const history = url.searchParams.get('history') === 'true';
  const today = todayInTimeZone(timeZone);
  return {
    symbol,
    symbols,
    level,
    kind,
    from,
    to,
    timeZone,
    dateMode,
    pushOnly,
    history,
    queryFrom: dateMode !== 'all' ? from || today : from,
    queryTo: dateMode !== 'all' ? to || today : to,
  };
}

function filterInsights(items, params) {
  const now = Date.now();
  let rows = [...(items || [])];
  rows = rows.filter((item) => {
    const expiresAt = item?.expiresAt ? new Date(item.expiresAt).getTime() : null;
    return !Number.isFinite(expiresAt) || expiresAt >= now;
  });
  if (params.dateMode !== 'all') {
    const today = todayInTimeZone(params.timeZone);
    rows = rows.filter((item) => item.generatedAt && dateKeyInTimeZone(item.generatedAt, params.timeZone) === today);
  }
  if (params.from) {
    rows = rows.filter(
      (item) => !item.generatedAt || dateKeyInTimeZone(item.generatedAt, params.timeZone) >= params.from,
    );
  }
  if (params.to) {
    rows = rows.filter(
      (item) => !item.generatedAt || dateKeyInTimeZone(item.generatedAt, params.timeZone) <= params.to,
    );
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
    generatedAt: item.generatedAt || null,
    expiresAt: item.expiresAt || null,
    provider: item.provider || 'rules',
    llm: item.llm || null,
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
