import { readDb } from '../../../db.mjs';
import { dateKeyInTimeZone, json } from '../../shared.mjs';

function todayInTimeZone(timeZone) {
  return dateKeyInTimeZone(new Date().toISOString(), timeZone);
}

function insightLogicalKey(item) {
  const kind = String(item?.kind || 'insight');
  if (kind === 'market_brief') return kind;
  const symbol = (item?.symbols || []).map((s) => String(s || '').trim().toUpperCase()).find(Boolean);
  if (kind === 'asset_signal' && symbol) return `${kind}:${symbol}`;
  return item?.id || `${kind}:${item?.title || ''}`;
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

function filterInsights(items, url) {
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const level = url.searchParams.get('level')?.trim();
  const kind = url.searchParams.get('kind')?.trim();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const timeZone = url.searchParams.get('timeZone') || 'Asia/Seoul';
  const dateMode = String(url.searchParams.get('date') || 'today').toLowerCase();
  const pushOnly = url.searchParams.get('pushCandidate') === 'true';
  const now = Date.now();
  let rows = [...(items || [])];
  rows = rows.filter((item) => {
    const expiresAt = item?.expiresAt ? new Date(item.expiresAt).getTime() : null;
    return !Number.isFinite(expiresAt) || expiresAt >= now;
  });
  if (dateMode !== 'all') {
    const today = todayInTimeZone(timeZone);
    rows = rows.filter((item) => item.generatedAt && dateKeyInTimeZone(item.generatedAt, timeZone) === today);
  }
  if (from) rows = rows.filter((item) => !item.generatedAt || dateKeyInTimeZone(item.generatedAt, timeZone) >= from);
  if (to) rows = rows.filter((item) => !item.generatedAt || dateKeyInTimeZone(item.generatedAt, timeZone) <= to);
  if (symbol) rows = rows.filter((item) => (item.symbols || []).map((s) => String(s).toUpperCase()).includes(symbol));
  if (level) rows = rows.filter((item) => item.level === level);
  if (kind) rows = rows.filter((item) => item.kind === kind);
  if (pushOnly) rows = rows.filter((item) => item.pushCandidate === true);
  if (url.searchParams.get('history') !== 'true') rows = newestLogicalInsights(rows);
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
    const db = await readDb();
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 10) || 10), 50);
    const offsetRaw = Number(url.searchParams.get('offset') || 0) || 0;
    const filtered = filterInsights(db.insightItems, url);
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
