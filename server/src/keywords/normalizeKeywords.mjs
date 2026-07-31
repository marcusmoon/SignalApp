/**
 * Agent-authored keywords on digests / market briefings / today briefings.
 * Stored in JSON payload — no DB migration.
 */

const KEYWORD_KINDS = new Set(['theme', 'symbol', 'macro', 'event']);
const MAX_KEYWORDS = 6;
const MAX_LABEL_LEN = 32;

/** Too generic for home chips — reject on ingest. */
const BANNED_LABELS = new Set([
  '시장',
  '뉴스',
  '속보',
  '증시',
  '주식',
  '상승',
  '하락',
  '강세',
  '약세',
  '오늘',
  '마감',
  '장중',
  'market',
  'markets',
  'news',
  'stock',
  'stocks',
  'up',
  'down',
  'today',
  'close',
]);

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeKind(value) {
  const kind = cleanText(value).toLowerCase();
  return KEYWORD_KINDS.has(kind) ? kind : 'theme';
}

function normalizeWeight(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function isBannedLabel(label) {
  const key = label.replace(/^#/, '').trim().toLowerCase();
  return !key || BANNED_LABELS.has(key);
}

/**
 * Accepts:
 * - `[{ label, kind?, weight? }, ...]`
 * - `["HBM", "005930", ...]` (kind defaults to theme; 6-digit / ticker-looking → symbol)
 */
export function normalizeKeywords(value, { limit = MAX_KEYWORDS } = {}) {
  const raw = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();

  for (const entry of raw) {
    if (out.length >= limit) break;
    let label = '';
    let kind = 'theme';
    let weight = 1;

    if (typeof entry === 'string') {
      label = cleanText(entry).replace(/^#/, '');
      // Bare strings: only KR 6-digit codes become symbols. Letter tickers need kind:"symbol".
      if (/^\d{6}$/.test(label)) {
        kind = 'symbol';
      }
    } else if (entry && typeof entry === 'object') {
      label = cleanText(entry.label || entry.name || entry.topic).replace(/^#/, '');
      kind = normalizeKind(entry.kind || entry.type);
      weight = normalizeWeight(entry.weight);
      if (kind === 'symbol') label = label.toUpperCase();
    }

    if (!label || label.length > MAX_LABEL_LEN || isBannedLabel(label)) continue;
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ label, kind, weight });
  }

  return out;
}

export function keywordsToTopicLabels(keywords) {
  return normalizeKeywords(keywords).map((k) => k.label);
}
