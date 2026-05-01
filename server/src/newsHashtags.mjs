/**
 * News hashtag labels (tickers or topical keywords), ordered for display.
 * Stored on each `newsItem` as `{ label, order, source }[]`.
 */

function looksLikeUsTicker(s) {
  const u = String(s || '').trim().toUpperCase();
  if (u.length < 1 || u.length > 5) return false;
  if (!/^[A-Z][A-Z0-9]*$/.test(u)) return false;
  return true;
}

export function normalizeNewsHashtagLabels(rawList, max = 8) {
  const out = [];
  const seen = new Set();
  for (const raw of rawList || []) {
    let s = String(raw ?? '')
      .trim()
      .replace(/^#+/u, '');
    if (!s || s.length > 48) continue;
    const display = looksLikeUsTicker(s) ? s.trim().toUpperCase() : s;
    const key = display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
    if (out.length >= max) break;
  }
  return out;
}

export function hashtagRecordsFromLabels(labels, source = 'auto') {
  const src = source === 'manual' ? 'manual' : 'auto';
  return normalizeNewsHashtagLabels(labels).map((label, order) => ({ label, order, source: src }));
}

export function hashtagLabelsForFilter(item) {
  const tags = Array.isArray(item?.hashtags) ? item.hashtags : [];
  return [...tags]
    .filter((t) => t && String(t.label || '').trim())
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((t) => String(t.label).trim());
}

export function sortedHashtagsForPublic(item) {
  const tags = Array.isArray(item?.hashtags) ? item.hashtags : [];
  return [...tags]
    .filter((t) => t && String(t.label || '').trim())
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((t) => ({
      label: String(t.label).trim(),
      order: Number(t.order) || 0,
      source: t.source === 'manual' ? 'manual' : 'auto',
    }));
}

export function mergeAutoHashtagsIntoNewsItem(item, labels) {
  if (!item) return;
  if (String(item.hashtagSource || 'auto') === 'manual') return;
  const records = hashtagRecordsFromLabels(labels, 'auto');
  item.hashtags = records;
  item.hashtagsUpdatedAt = new Date().toISOString();
}
