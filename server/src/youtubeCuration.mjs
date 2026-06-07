export function normalizeYoutubeHandle(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  const urlHandle = raw.match(/(?:youtube\.com|youtu\.be)\/@([^/?#\s]+)/i)?.[1];
  if (urlHandle) raw = urlHandle;
  raw = raw.replace(/^@+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  raw = raw.split('/').filter(Boolean).pop() || raw;
  return raw.replace(/[^A-Za-z0-9._-]/g, '').trim();
}

/** DB·API 필터용 — payload의 channelHandle·customUrl에서 핸들 키 추출 */
export function youtubeItemChannelHandleKey(item) {
  const direct = normalizeYoutubeHandle(item?.channelHandle);
  if (direct) return direct.toLowerCase();
  const customUrl = item?.rawPayload?.snippet?.customUrl;
  if (customUrl) {
    const fromUrl = normalizeYoutubeHandle(customUrl);
    if (fromUrl) return fromUrl.toLowerCase();
  }
  return '';
}

export function itemMatchesYoutubeChannelHandles(item, channelHandles) {
  if (!Array.isArray(channelHandles) || channelHandles.length === 0) return true;
  const key = youtubeItemChannelHandleKey(item);
  if (!key) return false;
  const wanted = new Set(
    channelHandles.map((h) => normalizeYoutubeHandle(h).toLowerCase()).filter(Boolean),
  );
  return wanted.has(key);
}

export function normalizeYoutubeCurationHandles(value) {
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
  return out;
}
