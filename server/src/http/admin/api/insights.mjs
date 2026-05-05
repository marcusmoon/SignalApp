import { readDb } from '../../../db.mjs';
import { dateKeyInTimeZone, json, paginate } from '../../shared.mjs';

function filterAdminInsights(items, url) {
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const kind = url.searchParams.get('kind')?.trim();
  const level = url.searchParams.get('level')?.trim();
  const pushCandidate = url.searchParams.get('pushCandidate')?.trim();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const timeZone = url.searchParams.get('timeZone');
  let rows = [...(items || [])];
  if (kind) rows = rows.filter((item) => item.kind === kind);
  if (level) rows = rows.filter((item) => item.level === level);
  if (pushCandidate === 'true') rows = rows.filter((item) => item.pushCandidate === true);
  if (pushCandidate === 'false') rows = rows.filter((item) => item.pushCandidate !== true);
  if (from) rows = rows.filter((item) => !item.generatedAt || dateKeyInTimeZone(item.generatedAt, timeZone) >= from);
  if (to) rows = rows.filter((item) => !item.generatedAt || dateKeyInTimeZone(item.generatedAt, timeZone) <= to);
  if (q) {
    rows = rows.filter((item) =>
      [
        item.id,
        item.kind,
        item.level,
        item.title,
        item.summary,
        item.provider,
        item.llm?.provider,
        item.llm?.model,
        ...(item.symbols || []),
        ...(item.topics || []),
        ...(item.reasoning || []),
        ...(item.sourceRefs || []).map((ref) => `${ref.title || ''} ${ref.sourceName || ''}`),
      ].some((value) => String(value || '').toLowerCase().includes(q)),
    );
  }
  return rows.sort(
    (a, b) =>
      String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
      Number(b.score || 0) - Number(a.score || 0),
  );
}

function adminInsight(item) {
  return {
    id: item.id,
    kind: item.kind || '',
    level: item.level || '',
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
    title: item.title || '',
    summary: item.summary || '',
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    topics: Array.isArray(item.topics) ? item.topics : [],
    reasoning: Array.isArray(item.reasoning) ? item.reasoning : [],
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    pushCandidate: item.pushCandidate === true,
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    provider: item.provider || 'rules',
    llm: item.llm || null,
    generatedAt: item.generatedAt || null,
    expiresAt: item.expiresAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function handleAdminInsightsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/insights') {
    const db = await readDb();
    const page = paginate(filterAdminInsights(db.insightItems, url).map(adminInsight), url, 30, 100);
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }
  return false;
}
