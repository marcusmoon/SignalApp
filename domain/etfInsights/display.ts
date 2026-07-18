/** ETF insight payload helpers — heatmap/themes/flowHighlights are loosely typed from ingest. */

export function etfInsightItemLabel(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const row = item as Record<string, unknown>;
  for (const key of ['label', 'name', 'title', 'symbol', 'theme', 'summary', 'text'] as const) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function etfInsightItemTrail(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const pct = row.changePercent;
  if (typeof pct === 'number' && Number.isFinite(pct)) {
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }
  const value = row.value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  const score = row.score;
  if (typeof score === 'number' && Number.isFinite(score)) return String(score);
  return null;
}

export function etfInsightLabeledRows(items: unknown[]): { label: string; trail: string | null }[] {
  const out: { label: string; trail: string | null }[] = [];
  for (const item of items) {
    const label = etfInsightItemLabel(item);
    if (!label) continue;
    out.push({ label, trail: etfInsightItemTrail(item) });
  }
  return out;
}

export function etfInsightRotationLines(rotation: Record<string, unknown> | null | undefined): string[] {
  if (!rotation) return [];
  const lines: string[] = [];
  for (const key of ['summary', 'headline', 'title', 'into', 'outOf', 'note'] as const) {
    const value = rotation[key];
    if (typeof value === 'string' && value.trim()) lines.push(value.trim());
  }
  for (const key of ['into', 'outOf', 'winners', 'losers'] as const) {
    const value = rotation[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const label = etfInsightItemLabel(item);
      if (label) lines.push(label);
    }
  }
  return lines.slice(0, 12);
}
