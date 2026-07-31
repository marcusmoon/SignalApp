type KeywordChipLike = {
  label: string;
  kind: string;
  weight: number;
  name?: string;
};

/** Canonical map key for keyword symbol lookup (`005930.KS` → `005930`). */
export function homeKeywordSymbolKey(label: string): string {
  const trimmed = String(label || '').trim().toUpperCase();
  if (!trimmed) return '';
  const yahooKr = trimmed.match(/^(\d{6})\.(KS|KQ)$/);
  if (yahooKr) return yahooKr[1];
  return trimmed;
}

/** KR codes (bare or Yahoo suffix). US letter tickers are kind-driven, not inferred. */
export function isTickerLikeLabel(label: string): boolean {
  const text = String(label || '').trim().toUpperCase();
  if (!text) return false;
  return /^\d{6}(\.(KS|KQ))?$/.test(text);
}

/** Reject names that are just the ticker / code again. */
export function isUsableCompanyName(name: string, symbolKey: string): boolean {
  const label = String(name || '').trim();
  if (!label) return false;
  const key = homeKeywordSymbolKey(symbolKey);
  if (!key) return false;
  if (label.toUpperCase() === key) return false;
  if (homeKeywordSymbolKey(label) === key) return false;
  if (isTickerLikeLabel(label)) return false;
  return true;
}

/** Build symbol → company/display name from briefing companies and quote rows. */
export function buildHomeKeywordSymbolNames(input: {
  companies?: Array<{ symbol?: string | null; name?: string | null } | null> | null;
  quotes?: Array<{ symbol?: string | null; name?: string | null } | null> | null;
}): Map<string, string> {
  const map = new Map<string, string>();
  const put = (symbol?: string | null, name?: string | null) => {
    const key = homeKeywordSymbolKey(String(symbol || ''));
    if (!key || !isUsableCompanyName(String(name || ''), key)) return;
    if (!map.has(key)) map.set(key, String(name).trim());
  };
  for (const row of input.companies ?? []) put(row?.symbol, row?.name);
  for (const row of input.quotes ?? []) put(row?.symbol, row?.name);
  return map;
}

/** True when the chip should display as a symbol (logo + company name). */
export function homeKeywordIsSymbolChip(chip: KeywordChipLike): boolean {
  return chip.kind === 'symbol' || isTickerLikeLabel(chip.label);
}

/** Symbol chips prefer company name; other kinds keep the agent label. */
export function homeKeywordChipLabel(
  chip: KeywordChipLike,
  symbolNames: Map<string, string>,
): string {
  if (!homeKeywordIsSymbolChip(chip)) return chip.label;
  const key = homeKeywordSymbolKey(chip.label);
  const embedded = String(chip.name || '').trim();
  if (isUsableCompanyName(embedded, key)) return embedded;
  return symbolNames.get(key) || chip.label;
}
