/**
 * Home 「섹터 흐름」 lead — short prose above the heatmap.
 * Prefer summary; else rotation `from → to` (no confidence / extras).
 */

type EtfHomeLeadInsight = {
  summary?: string | null;
  rotation?: Record<string, unknown> | null;
};

function rotationLeadLine(rotation: Record<string, unknown> | null | undefined): string {
  if (!rotation) return '';
  const from = String(rotation.from ?? '').trim();
  const to = String(rotation.to ?? '').trim();
  if (from && to) return `${from} → ${to}`;
  if (to) return `→ ${to}`;
  if (from) return from;
  return '';
}

export function etfHomeLeadText(insight: EtfHomeLeadInsight | null | undefined): string {
  if (!insight) return '';
  const summary = String(insight.summary || '').trim();
  if (summary) return summary;
  return rotationLeadLine(insight.rotation);
}
