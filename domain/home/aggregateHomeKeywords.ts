export type SignalKeywordKind = 'theme' | 'sector' | 'symbol' | 'macro' | 'event';

export type SignalKeyword = {
  label: string;
  kind: SignalKeywordKind;
  weight: number;
  /** Display name when label is a ticker (kind=symbol). */
  name?: string;
  /** Short scan context for home rank list (agent `why`/`reason`). */
  why?: string;
};

export type HomeKeywordChip = SignalKeyword & {
  /** Prefer opening this digest when kind is not symbol. */
  digestId?: string | null;
};

/** Home keyword strip shows a short top set only. */
export const HOME_KEYWORD_LIMIT = 6;

const KIND_BOOST: Record<string, number> = {
  today: 1.4,
  market: 1.2,
  digest: 1,
};

function looksLikeKrCode(label: string): boolean {
  return /^\d{6}(\.(KS|KQ))?$/i.test(String(label || '').trim());
}

function normalizeSymbolLabel(label: string): string {
  const trimmed = String(label || '').trim().toUpperCase();
  const m = trimmed.match(/^(\d{6})\.(KS|KQ)$/);
  return m ? m[1] : trimmed;
}

function usableCompanyName(name: string, symbolKey: string): boolean {
  const label = String(name || '').trim();
  if (!label) return false;
  const key = normalizeSymbolLabel(symbolKey);
  if (!key) return false;
  if (label.toUpperCase() === key) return false;
  if (normalizeSymbolLabel(label) === key) return false;
  if (looksLikeKrCode(label)) return false;
  return true;
}

function asKeywordList(value: unknown): SignalKeyword[] {
  if (!Array.isArray(value)) return [];
  const out: SignalKeyword[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const raw = entry.trim().replace(/^#/, '');
      if (!raw) continue;
      const isCode = looksLikeKrCode(raw);
      out.push({
        label: isCode ? normalizeSymbolLabel(raw) : raw,
        kind: isCode ? 'symbol' : 'theme',
        weight: 1,
      });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as {
      label?: unknown;
      kind?: unknown;
      weight?: unknown;
      name?: unknown;
      symbol?: unknown;
      ticker?: unknown;
      displayName?: unknown;
      companyName?: unknown;
      topic?: unknown;
      why?: unknown;
      reason?: unknown;
      context?: unknown;
    };
    let kindRaw = String(row.kind ?? 'theme').toLowerCase();
    let kind: SignalKeywordKind =
      kindRaw === 'symbol' ||
      kindRaw === 'macro' ||
      kindRaw === 'event' ||
      kindRaw === 'sector'
        ? kindRaw
        : 'theme';
    const weight =
      typeof row.weight === 'number' && Number.isFinite(row.weight)
        ? Math.max(0, Math.min(1, row.weight))
        : 1;

    let label = '';
    let name = '';
    if (kind === 'symbol') {
      label = String(row.symbol ?? row.label ?? row.ticker ?? '')
        .trim()
        .replace(/^#/, '');
      name = String(row.name ?? row.displayName ?? row.companyName ?? '').trim();
    } else {
      label = String(row.label ?? row.topic ?? row.name ?? '')
        .trim()
        .replace(/^#/, '');
      if (looksLikeKrCode(label)) {
        kind = 'symbol';
        name = String(row.displayName ?? row.companyName ?? row.name ?? '').trim();
      }
    }
    if (!label) continue;
    if (kind === 'symbol') {
      label = normalizeSymbolLabel(label);
      if (!usableCompanyName(name, label)) name = '';
    }
    const why = String(row.why ?? row.reason ?? row.context ?? '')
      .trim()
      .slice(0, 48);
    out.push({
      label,
      kind,
      weight,
      ...(name ? { name } : null),
      ...(why ? { why } : null),
    });
  }
  return out;
}

/** Fallback when agents only filled legacy `topics`. */
export function keywordsFromTopics(topics: unknown): SignalKeyword[] {
  if (!Array.isArray(topics)) return [];
  return asKeywordList(topics.map((t) => String(t || '').trim()).filter(Boolean));
}

type AggregateInput = {
  todayKeywords?: unknown;
  marketKeywordLists?: unknown[];
  digestRows?: Array<{ id?: string | null; keywords?: unknown; topics?: unknown }>;
  limit?: number;
};

/**
 * Merge agent keywords for the home rank list.
 * Priority boost: today briefing > market briefing > news digests.
 * Digests without `keywords` fall back to `topics`.
 */
export function aggregateHomeKeywords(input: AggregateInput): HomeKeywordChip[] {
  const limit = Math.max(1, Math.min(12, input.limit ?? HOME_KEYWORD_LIMIT));
  const scores = new Map<string, HomeKeywordChip>();

  const bump = (
    list: SignalKeyword[],
    source: keyof typeof KIND_BOOST,
    digestId?: string | null,
  ) => {
    const boost = KIND_BOOST[source] ?? 1;
    for (const item of list) {
      const key = item.label.toLowerCase();
      const nextWeight = item.weight * boost;
      const prev = scores.get(key);
      if (!prev || nextWeight > prev.weight) {
        scores.set(key, {
          label: item.label,
          kind: item.kind,
          weight: nextWeight,
          ...(item.name ? { name: item.name } : null),
          ...(item.why ? { why: item.why } : null),
          digestId: digestId ?? prev?.digestId ?? null,
        });
      } else {
        const next: HomeKeywordChip = { ...prev };
        if (!next.digestId && digestId) next.digestId = digestId;
        if (!next.name && item.name) next.name = item.name;
        if (!next.why && item.why) next.why = item.why;
        scores.set(key, next);
      }
    }
  };

  bump(asKeywordList(input.todayKeywords), 'today');

  for (const list of input.marketKeywordLists ?? []) {
    bump(asKeywordList(list), 'market');
  }

  for (const row of input.digestRows ?? []) {
    const fromKeywords = asKeywordList(row.keywords);
    const list = fromKeywords.length > 0 ? fromKeywords : keywordsFromTopics(row.topics);
    bump(list, 'digest', row.id ?? null);
  }

  return [...scores.values()]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, 'ko'))
    .slice(0, limit);
}

/** Symbol tickers on the home list (for name lookup). */
export function homeKeywordSymbolLabels(chips: HomeKeywordChip[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chip of chips) {
    if (chip.kind !== 'symbol' && !looksLikeKrCode(chip.label)) continue;
    const key = normalizeSymbolLabel(chip.label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Ticker codes that still need a quote/company name lookup. */
export function homeKeywordSymbolsMissingNames(chips: HomeKeywordChip[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chip of chips) {
    if (chip.kind !== 'symbol' && !looksLikeKrCode(chip.label)) continue;
    const key = normalizeSymbolLabel(chip.label);
    if (!key || seen.has(key)) continue;
    if (usableCompanyName(String(chip.name || ''), key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function hasUsableKeywords(value: unknown): boolean {
  return asKeywordList(value).length > 0;
}

function pickLatestIso(candidates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const raw of candidates) {
    const iso = String(raw || '').trim();
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = iso;
    }
  }
  return best;
}

type KeywordsAsOfInput = {
  todayKeywords?: unknown;
  todayGeneratedAt?: string | null;
  marketRows?: Array<{ keywords?: unknown; at?: string | null }>;
  digestRows?: Array<{
    keywords?: unknown;
    topics?: unknown;
    at?: string | null;
  }>;
};

/**
 * Newest `generatedAt`/`publishedAt` among sources that actually contributed
 * keywords (or digest topics fallback). Not a dedicated keywords timestamp.
 */
export function resolveHomeKeywordsAsOfIso(input: KeywordsAsOfInput): string | null {
  const candidates: Array<string | null | undefined> = [];
  if (hasUsableKeywords(input.todayKeywords)) {
    candidates.push(input.todayGeneratedAt);
  }
  for (const row of input.marketRows ?? []) {
    if (!hasUsableKeywords(row.keywords)) continue;
    candidates.push(row.at);
  }
  for (const row of input.digestRows ?? []) {
    const fromKeywords = asKeywordList(row.keywords);
    const list = fromKeywords.length > 0 ? fromKeywords : keywordsFromTopics(row.topics);
    if (list.length === 0) continue;
    candidates.push(row.at);
  }
  return pickLatestIso(candidates);
}
