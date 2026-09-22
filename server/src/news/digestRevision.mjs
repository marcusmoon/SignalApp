import { createHash } from 'node:crypto';

export class DigestContractError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const text = (value) => typeof value === 'string' ? value.trim() : '';
const fail = (message) => { throw new DigestContractError(message); };
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);

/** A revision is immutable; timestamps and presentation rank are not its identity. */
export function normalizeDigestRevision(raw, index, now) {
  const storyId = text(raw?.storyId);
  const category = text(raw?.category);
  const changeType = text(raw?.changeType);
  const previousDigestId = text(raw?.previousDigestId) || null;
  if (!/^[a-z0-9][a-z0-9:_-]{5,159}$/.test(storyId)) fail('INVALID_STORY_ID');
  if (!['global', 'korea', 'crypto'].includes(category)) fail('INVALID_CATEGORY');
  if (!['new', 'update', 'correction'].includes(changeType)) fail('INVALID_CHANGE_TYPE');
  if ((changeType === 'new') === Boolean(previousDigestId)) fail('INVALID_PREVIOUS_DIGEST');
  const title = text(raw.title);
  const summary = text(raw.summary);
  if (!title || title.length > 160 || !summary || summary.length > 2000) fail('INVALID_DIGEST_TEXT');
  if (!/Z$/.test(text(raw.generatedAt)) || !Number.isFinite(Date.parse(raw.generatedAt))) fail('UTC_GENERATED_AT_REQUIRED');
  const generatedAt = new Date(raw.generatedAt).toISOString();
  if (Date.parse(generatedAt) > Date.parse(now) + 300000) fail('FUTURE_GENERATED_AT');
  const sourceRefs = (Array.isArray(raw.sourceRefs) ? raw.sourceRefs : []).map((ref) => ({
    id: text(ref?.id), type: 'news', relation: text(ref?.relation),
  }));
  if (!sourceRefs.length || sourceRefs.length > 3 || sourceRefs.some((ref) => !ref.id || !['primary', 'supporting'].includes(ref.relation))) fail('INVALID_SOURCE_REFS');
  if (new Set(sourceRefs.map((ref) => ref.id)).size !== sourceRefs.length || sourceRefs.filter((ref) => ref.relation === 'primary').length !== 1) fail('INVALID_PRIMARY_SOURCE');
  if (raw.sourceRefs.some((ref) => ref?.type !== 'news')) fail('NEWS_EVIDENCE_REQUIRED');
  const changes = (Array.isArray(raw.changes) ? raw.changes : []).map((change) => ({
    text: text(change?.text),
    sourceIds: [...new Set((Array.isArray(change?.sourceIds) ? change.sourceIds : []).map(text))].sort(),
  }));
  const ids = new Set(sourceRefs.map((ref) => ref.id));
  if (!changes.length || changes.length > 3 || changes.some((change) => !change.text || change.text.length > 500 || !change.sourceIds.length || change.sourceIds.some((id) => !ids.has(id)))) fail('CHANGE_EVIDENCE_REQUIRED');
  const symbols = [...new Set((Array.isArray(raw.symbols) ? raw.symbols : []).map(text).map((s) => s.toUpperCase()).filter(Boolean))].sort().slice(0, 12);
  const revisionId = hash([storyId, category, previousDigestId, changeType, title, summary, changes, symbols, [...sourceRefs].sort((a, b) => a.id.localeCompare(b.id))]);
  return {
    ...raw, id: `news-revision:${revisionId}`, storyId, revisionId, previousDigestId,
    changeType, changes, title, summary, category, symbols, sourceRefs,
    generatedAt, generatedDate: generatedAt.slice(0, 10), updatedAt: now,
    primaryNewsId: sourceRefs.find((ref) => ref.relation === 'primary').id,
    aiGenerated: true, score: 100 - index, schemaVersion: 3,
  };
}

export function validateDigestPredecessor(item, latest) {
  if (!latest && item.previousDigestId) throw new DigestContractError('PREVIOUS_DIGEST_NOT_FOUND', 409);
  if (latest && (latest.id !== item.previousDigestId || latest.category !== item.category)) {
    throw new DigestContractError('STORY_CHANGED_REFRESH_CONTEXT', 409);
  }
  if (latest && Date.parse(item.generatedAt) < Date.parse(latest.generatedAt)) throw new DigestContractError('REVISION_TIME_REVERSED', 409);
  if (latest && item.title === latest.title && item.summary === latest.summary) {
    throw new DigestContractError('NO_MATERIAL_CHANGE', 409);
  }
}
