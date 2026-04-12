export { DEFAULT_KOREA_NEWS_KEYWORDS } from './constants';

const MAX_KEYWORDS = 80;
const MAX_KEYWORD_LEN = 120;

/** Trim, dedupe (case-insensitive), cap count/length; empty strings dropped. */
export function normalizeKoreaNewsExtraKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, MAX_KEYWORD_LEN);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}
