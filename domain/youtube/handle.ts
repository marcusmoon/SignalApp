export const YOUTUBE_HANDLE_MAX_LEN = 100;

export function normalizeYoutubeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

/** YouTube 핸들에 가까운 형태만 허용 (공백·특수문자 최소화) */
export function isValidYoutubeHandle(handle: string): boolean {
  if (!handle || handle.length > YOUTUBE_HANDLE_MAX_LEN) return false;
  return /^[a-zA-Z0-9._-]+$/.test(handle);
}

export function dedupeStringsPreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of items) {
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out;
}
