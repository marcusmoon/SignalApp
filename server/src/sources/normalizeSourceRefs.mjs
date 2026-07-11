import { cleanText } from '../db/repositories/publicHelpers.mjs';

const RELATIONS = new Set(['primary', 'supporting', 'background']);

function refId(ref) {
  return cleanText(ref?.id || ref?.newsId);
}

function refType(ref) {
  const raw = cleanText(ref?.type || ref?.kind).toLowerCase();
  if (raw === 'filing') return 'disclosure';
  return raw || 'news';
}

function isDisclosureType(type) {
  return type === 'disclosure' || type === 'filing';
}

/**
 * Ingest-time normalization: keep canonical refs as { type, id, relation? } only.
 * External refs without id keep a minimal stub (url + optional title/sourceName).
 */
export function normalizeSourceRef(ref) {
  if (!ref || typeof ref !== 'object') return null;

  const type = refType(ref);
  const id = refId(ref);
  const relation = cleanText(ref?.relation);
  const normalized = { type };
  if (relation && RELATIONS.has(relation)) normalized.relation = relation;

  if (id) {
    normalized.id = id;
    return normalized;
  }

  const url = cleanText(ref?.url);
  const title = cleanText(ref?.title);
  const sourceName = cleanText(ref?.sourceName);
  if (!url && !title) return null;

  if (url) normalized.url = url;
  if (title) normalized.title = title;
  if (sourceName) normalized.sourceName = sourceName;

  if (isDisclosureType(type)) {
    const companyName = cleanText(ref?.companyName);
    const symbol = cleanText(ref?.symbol);
    const formType = cleanText(ref?.formType);
    if (companyName) normalized.companyName = companyName;
    if (symbol) normalized.symbol = symbol;
    if (formType) normalized.formType = formType;
    if (ref?.filedAt) normalized.filedAt = ref.filedAt;
  } else if (ref?.publishedAt) {
    normalized.publishedAt = ref.publishedAt;
  }

  return normalized;
}

export function normalizeSourceRefs(sourceRefs, options = {}) {
  const limit = Math.max(1, Math.min(50, Number(options.limit) || 30));
  return (Array.isArray(sourceRefs) ? sourceRefs : [])
    .map(normalizeSourceRef)
    .filter(Boolean)
    .slice(0, limit);
}
