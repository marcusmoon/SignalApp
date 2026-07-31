/**
 * Agent-authored keywords on digests / market briefings / today briefings.
 * Stored in JSON payload — no DB migration.
 */

const KEYWORD_KINDS = new Set(['theme', 'sector', 'symbol', 'macro', 'event']);
const MAX_KEYWORDS = 6;
const MAX_LABEL_LEN = 32;
const MAX_WHY_LEN = 48;

/** Too generic for home chips — reject on ingest. */
const BANNED_LABELS = new Set([
  '시장',
  '뉴스',
  '속보',
  '증시',
  '주식',
  '투자',
  '전망',
  '급락',
  '랠리',
  '수급',
  '관망',
  '변동성',
  '투자심리',
  '코스피',
  '코스닥',
  '나스닥',
  '다우',
  's&p500',
  'sp500',
  's&p',
  '^gspc',
  '^ixic',
  '^dji',
  '^ks11',
  '^kq11',
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
  if (!key || BANNED_LABELS.has(key)) return true;
  if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(key)) return true;
  if (/^[월화수목금토일]요일?$/.test(key)) return true;
  return false;
}

function looksLikeSymbolCode(label) {
  const text = cleanText(label);
  if (/^\d{6}$/.test(text)) return true;
  if (/^\d{6}\.(KS|KQ)$/i.test(text)) return true;
  if (/^\^[A-Z0-9.]{2,8}$/i.test(text)) return true;
  if (/^[A-Z]{1,5}(\.[A-Z]{1,3})?$/.test(text.toUpperCase()) && /[A-Z]/.test(text)) {
    // Letter tickers only when explicitly kind=symbol (caller decides).
    return false;
  }
  return false;
}

/**
 * Accepts:
 * - `[{ label|symbol, kind?, weight?, name?, why? }, ...]`
 * - `["HBM", "005930", ...]` (6-digit codes → symbol)
 * For symbols, `label`/`symbol` is the ticker; optional `name` is the display name.
 * Optional `why`/`reason` is short home-rank context.
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
    let name = '';
    let why = '';

    if (typeof entry === 'string') {
      label = cleanText(entry).replace(/^#/, '');
      if (looksLikeSymbolCode(label)) {
        kind = 'symbol';
      }
    } else if (entry && typeof entry === 'object') {
      kind = normalizeKind(entry.kind || entry.type);
      weight = normalizeWeight(entry.weight);
      why = cleanText(entry.why || entry.reason || entry.context).slice(0, MAX_WHY_LEN);
      if (kind === 'symbol') {
        label = cleanText(entry.symbol || entry.label || entry.ticker).replace(/^#/, '');
        name = cleanText(entry.name || entry.displayName || entry.companyName);
        if (label) label = label.toUpperCase();
      } else {
        label = cleanText(entry.label || entry.topic || entry.name).replace(/^#/, '');
        if (looksLikeSymbolCode(label)) {
          kind = 'symbol';
          name = cleanText(entry.displayName || entry.companyName || entry.name);
          if (name.toUpperCase() === label.toUpperCase()) name = '';
          label = label.toUpperCase();
        }
      }
    }

    if (!label || label.length > MAX_LABEL_LEN || isBannedLabel(label)) continue;
    if (label.length < 2 && !looksLikeSymbolCode(label)) continue;
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const row = { label, kind, weight };
    if (kind === 'symbol' && name) row.name = name;
    if (why) row.why = why;
    out.push(row);
  }

  return out;
}

export function keywordsToTopicLabels(keywords) {
  return normalizeKeywords(keywords).map((k) => k.label);
}
