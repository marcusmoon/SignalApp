export type SignalKeywordKind = 'theme' | 'symbol' | 'macro' | 'event';

export type SignalKeyword = {
  label: string;
  kind: SignalKeywordKind;
  weight: number;
};

export type HomeKeywordChip = SignalKeyword & {
  /** Prefer opening this digest when kind is not symbol. */
  digestId?: string | null;
};

const KIND_BOOST: Record<string, number> = {
  today: 1.4,
  market: 1.2,
  digest: 1,
};

function asKeywordList(value: unknown): SignalKeyword[] {
  if (!Array.isArray(value)) return [];
  const out: SignalKeyword[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const label = entry.trim().replace(/^#/, '');
      if (!label) continue;
      out.push({
        label,
        kind: /^\d{6}$/.test(label) ? 'symbol' : 'theme',
        weight: 1,
      });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as { label?: unknown; kind?: unknown; weight?: unknown; name?: unknown };
    const label = String(row.label ?? row.name ?? '')
      .trim()
      .replace(/^#/, '');
    if (!label) continue;
    const kindRaw = String(row.kind ?? 'theme').toLowerCase();
    const kind: SignalKeywordKind =
      kindRaw === 'symbol' || kindRaw === 'macro' || kindRaw === 'event' ? kindRaw : 'theme';
    const weight =
      typeof row.weight === 'number' && Number.isFinite(row.weight)
        ? Math.max(0, Math.min(1, row.weight))
        : 1;
    out.push({ label: kind === 'symbol' ? label.toUpperCase() : label, kind, weight });
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
 * Merge agent keywords for the home chip strip.
 * Priority boost: today briefing > market briefing > news digests.
 * Digests without `keywords` fall back to `topics`.
 */
export function aggregateHomeKeywords(input: AggregateInput): HomeKeywordChip[] {
  const limit = Math.max(1, Math.min(12, input.limit ?? 7));
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
          digestId: digestId ?? prev?.digestId ?? null,
        });
      } else if (!prev.digestId && digestId) {
        scores.set(key, { ...prev, digestId });
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

/** Display order for home keyword groups. Empty groups are omitted. */
export const HOME_KEYWORD_KIND_ORDER: SignalKeywordKind[] = ['theme', 'symbol', 'macro', 'event'];

export type HomeKeywordGroup = {
  kind: SignalKeywordKind;
  items: HomeKeywordChip[];
};

export function groupHomeKeywords(chips: HomeKeywordChip[]): HomeKeywordGroup[] {
  const buckets: Record<SignalKeywordKind, HomeKeywordChip[]> = {
    theme: [],
    symbol: [],
    macro: [],
    event: [],
  };
  for (const chip of chips) {
    buckets[chip.kind].push(chip);
  }
  return HOME_KEYWORD_KIND_ORDER.filter((kind) => buckets[kind].length > 0).map((kind) => ({
    kind,
    items: buckets[kind],
  }));
}
