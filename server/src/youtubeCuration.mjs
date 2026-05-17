export const DEFAULT_YOUTUBE_CURATION_HANDLES = ['futuresnow', 'LikeUSStock', 't3chfeed', 'unrealtech', 'lucky_tv'];

export function normalizeYoutubeHandle(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  const urlHandle = raw.match(/(?:youtube\.com|youtu\.be)\/@([^/?#\s]+)/i)?.[1];
  if (urlHandle) raw = urlHandle;
  raw = raw.replace(/^@+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  raw = raw.split('/').filter(Boolean).pop() || raw;
  return raw.replace(/[^A-Za-z0-9._-]/g, '').trim();
}

export function normalizeYoutubeCurationHandles(value, { fallbackDefault = true } = {}) {
  const input = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\n,\s]+/)
        .map((part) => part.trim());
  const seen = new Set();
  const out = [];
  for (const item of input) {
    const handle = normalizeYoutubeHandle(item);
    if (!handle) continue;
    const key = handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(handle);
  }
  if (out.length === 0 && fallbackDefault) return [...DEFAULT_YOUTUBE_CURATION_HANDLES];
  return out;
}
