import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';

/** Build symbol → company/display name from briefing companies and quote rows. */
export function buildHomeKeywordSymbolNames(input: {
  companies?: Array<{ symbol?: string | null; name?: string | null } | null> | null;
  quotes?: Array<{ symbol?: string | null; name?: string | null } | null> | null;
}): Map<string, string> {
  const map = new Map<string, string>();
  const put = (symbol?: string | null, name?: string | null) => {
    const key = String(symbol || '')
      .trim()
      .toUpperCase();
    const label = String(name || '').trim();
    if (!key || !label) return;
    if (!map.has(key)) map.set(key, label);
  };
  for (const row of input.companies ?? []) put(row?.symbol, row?.name);
  for (const row of input.quotes ?? []) put(row?.symbol, row?.name);
  return map;
}

/** Symbol chips prefer company name; other kinds keep the agent label. */
export function homeKeywordChipLabel(
  chip: HomeKeywordChip,
  symbolNames: Map<string, string>,
): string {
  if (chip.kind !== 'symbol') return chip.label;
  const key = chip.label.trim().toUpperCase();
  return symbolNames.get(key) || chip.label;
}
