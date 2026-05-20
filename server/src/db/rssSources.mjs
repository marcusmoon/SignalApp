import { defaultRssSources } from './defaults.mjs';
import { nowIso } from './time.mjs';

export function normalizeRssSourceId(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeCategory(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'crypto') return 'crypto';
  if (value === 'korea') return 'korea';
  if (value === 'earnings') return 'earnings';
  if (value === 'filings') return 'filings';
  return 'global';
}

function normalizeKeywordList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeRssSource(raw, index = 0) {
  const now = nowIso();
  const feedUrl = String(raw?.feedUrl || '').trim();
  const sourceName = String(raw?.sourceName || raw?.name || '').trim();
  const providerId = normalizeRssSourceId(raw?.providerId || raw?.id || sourceName || 'rss');
  const id = normalizeRssSourceId(raw?.id || providerId);
  return {
    id,
    name: String(raw?.name || sourceName || id || 'RSS').trim(),
    providerId,
    sourceName: sourceName || String(raw?.name || id || 'RSS').trim(),
    feedUrl,
    category: normalizeCategory(raw?.category),
    enabled: raw?.enabled !== false,
    hidden: raw?.hidden === true,
    order: Number.isFinite(Number(raw?.order)) ? Number(raw.order) : index + 1,
    defaultLimit: Math.max(1, Math.min(100, Number(raw?.defaultLimit || raw?.limit || 40) || 40)),
    daysBack: Math.max(0, Math.min(365, Number(raw?.daysBack || 0) || 0)),
    includeKeywords: normalizeKeywordList(raw?.includeKeywords),
    excludeKeywords: normalizeKeywordList(raw?.excludeKeywords),
    userAgent: String(raw?.userAgent || '').trim(),
    createdAt: raw?.createdAt || now,
    updatedAt: raw?.updatedAt || now,
  };
}

export function rssSourceParams(source, overrides = {}) {
  const normalized = normalizeRssSource(source);
  return {
    ...overrides,
    providerId: normalized.providerId,
    sourceName: normalized.sourceName,
    category: normalized.category === 'earnings' || normalized.category === 'filings' ? 'global' : normalized.category,
    feedUrl: normalized.feedUrl,
    limit: Number(overrides.limit || normalized.defaultLimit || 40),
    daysBack: overrides.daysBack ?? normalized.daysBack,
    includeKeywords:
      Array.isArray(overrides.includeKeywords) && overrides.includeKeywords.length > 0
        ? overrides.includeKeywords
        : normalized.includeKeywords,
    excludeKeywords:
      Array.isArray(overrides.excludeKeywords) && overrides.excludeKeywords.length > 0
        ? overrides.excludeKeywords
        : normalized.excludeKeywords,
    userAgent: overrides.userAgent || normalized.userAgent || undefined,
  };
}

export function ensureRssSourcesCatalog(db) {
  if (!db || typeof db !== 'object') return [];
  const defaults = defaultRssSources();
  const catalogVersion = Number(db.meta?.rssSourcesCatalogVersion || 0) || 0;
  const shouldSeedDefaults = !Array.isArray(db.rssSources) || catalogVersion < 1;
  const existing = Array.isArray(db.rssSources) ? db.rssSources : [];
  const byId = new Map();
  existing.forEach((row, index) => {
    const normalized = normalizeRssSource(row, index);
    if (normalized.id && normalized.feedUrl) byId.set(normalized.id, normalized);
  });
  if (shouldSeedDefaults) {
    defaults.forEach((row, index) => {
      const normalized = normalizeRssSource(row, byId.size + index);
      if (normalized.id && normalized.feedUrl && !byId.has(normalized.id)) byId.set(normalized.id, normalized);
    });
  }
  db.rssSources = [...byId.values()].sort(
    (a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0) ||
      String(a.name || '').localeCompare(String(b.name || '')),
  );
  db.meta = db.meta && typeof db.meta === 'object' ? db.meta : {};
  db.meta.rssSourcesCatalogVersion = 1;
  return db.rssSources;
}

export function getRssSource(db, id) {
  const key = normalizeRssSourceId(id);
  if (!key) return null;
  return ensureRssSourcesCatalog(db).find((source) => source.id === key) || null;
}

export function publicRssSource(source) {
  const normalized = normalizeRssSource(source);
  return {
    id: normalized.id,
    name: normalized.name,
    providerId: normalized.providerId,
    sourceName: normalized.sourceName,
    feedUrl: normalized.feedUrl,
    category: normalized.category,
    enabled: normalized.enabled,
    hidden: normalized.hidden,
    order: normalized.order,
    defaultLimit: normalized.defaultLimit,
    daysBack: normalized.daysBack,
    includeKeywords: normalized.includeKeywords,
    excludeKeywords: normalized.excludeKeywords,
    userAgent: normalized.userAgent,
    updatedAt: normalized.updatedAt,
  };
}
