function compactText(value) {
  return String(value || '').trim();
}

function firstSymbol(item) {
  return (Array.isArray(item?.symbols) ? item.symbols : [])
    .map((symbol) => compactText(symbol).toUpperCase())
    .find(Boolean);
}

export function normalizeInsightDisplayKey(item) {
  const kind = compactText(item?.kind) || 'insight';
  if (kind === 'market_brief') return kind;
  const symbol = firstSymbol(item);
  if (kind === 'asset_signal' && symbol) return `${kind}:${symbol}`;
  return compactText(item?.id) || `${kind}:${compactText(item?.title)}`;
}

export function insightGeneratedDate(item) {
  const value = compactText(item?.generatedAt);
  return value.length >= 10 ? value.slice(0, 10) : null;
}
