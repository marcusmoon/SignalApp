import { etfInsightDisplayTicker } from '@/domain/etfInsights/openSymbol';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';

export type EtfHomeHeatCell = {
  key: string;
  title: string;
  subtitle: string | null;
  changePercent: number | null;
};

/** Compact heatmap cells for the home 「섹터 흐름」 card (no press handlers). */
export function etfHomeHeatmapCells(insight: SignalApiEtfInsight, maxCells = 6): EtfHomeHeatCell[] {
  const raw = Array.isArray(insight.heatmap) ? insight.heatmap : [];
  const cells: EtfHomeHeatCell[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index] && typeof raw[index] === 'object' ? (raw[index] as Record<string, unknown>) : {};
    const etf = String(item.etf ?? item.symbol ?? '').trim();
    const sector = String(item.sector ?? item.name ?? item.label ?? '').trim();
    if (!etf && !sector) continue;
    const pct =
      typeof item.changePercent === 'number' && Number.isFinite(item.changePercent)
        ? item.changePercent
        : null;
    const ticker = etfInsightDisplayTicker(etf) || sector || '—';
    cells.push({
      key: `${insight.id}-home-heat-${etf || sector}-${index}`,
      title: ticker,
      subtitle: sector && etf ? sector : null,
      changePercent: pct,
    });
  }
  return cells.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, maxCells);
}
