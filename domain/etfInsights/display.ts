/** ETF insight payload helpers — matches ingest shape from production. */

export function etfInsightItemLabel(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const row = item as Record<string, unknown>;
  for (const key of ['label', 'name', 'title', 'sector', 'etf', 'symbol', 'theme', 'summary', 'text'] as const) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

/** Heatmap row: "에너지 · XLE" */
export function etfInsightHeatmapLabel(item: unknown): string {
  if (!item || typeof item !== 'object') return etfInsightItemLabel(item);
  const row = item as Record<string, unknown>;
  const sector = String(row.sector ?? '').trim();
  const etf = String(row.etf ?? row.symbol ?? '').trim();
  if (sector && etf) return `${sector} · ${etf}`;
  return sector || etf || etfInsightItemLabel(item);
}

/** Theme row title prefers name; trail can be momentum. */
export function etfInsightThemeLabel(item: unknown): string {
  if (!item || typeof item !== 'object') return etfInsightItemLabel(item);
  const row = item as Record<string, unknown>;
  return String(row.name ?? row.label ?? row.title ?? '').trim() || etfInsightItemLabel(item);
}

export function etfInsightItemTrail(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const pct = row.changePercent;
  if (typeof pct === 'number' && Number.isFinite(pct)) {
    const sign = pct > 0 ? '+' : '';
    const trend = String(row.trend ?? '').trim();
    return trend ? `${trend} ${sign}${pct.toFixed(2)}%` : `${sign}${pct.toFixed(2)}%`;
  }
  const momentum = String(row.momentum ?? '').trim();
  if (momentum) return momentum;
  const value = row.value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  const score = row.score;
  if (typeof score === 'number' && Number.isFinite(score)) return String(score);
  return null;
}

export function etfInsightLabeledRows(
  items: unknown[],
  labelFn: (item: unknown) => string = etfInsightItemLabel,
): { label: string; trail: string | null; summary: string | null }[] {
  const out: { label: string; trail: string | null; summary: string | null }[] = [];
  for (const item of items) {
    const label = labelFn(item);
    if (!label) continue;
    const summary =
      item && typeof item === 'object'
        ? String((item as Record<string, unknown>).summary ?? '').trim() || null
        : null;
    out.push({ label, trail: etfInsightItemTrail(item), summary });
  }
  return out;
}

export function etfInsightRotationLines(rotation: Record<string, unknown> | null | undefined): string[] {
  if (!rotation) return [];
  const lines: string[] = [];
  const from = String(rotation.from ?? '').trim();
  const to = String(rotation.to ?? '').trim();
  if (from && to) lines.push(`${from} → ${to}`);
  else if (to) lines.push(`→ ${to}`);
  else if (from) lines.push(from);

  for (const key of ['summary', 'headline', 'title', 'note'] as const) {
    const value = rotation[key];
    if (typeof value === 'string' && value.trim()) lines.push(value.trim());
  }
  const confidence = String(rotation.confidence ?? '').trim();
  if (confidence) lines.push(`confidence: ${confidence}`);

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
