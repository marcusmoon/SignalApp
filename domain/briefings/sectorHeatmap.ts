import { trendToSoftChangePercent } from '@/domain/heatmaps/changeHeat';
import type { SignalApiMarketBriefingSector } from '@/integrations/signal-api/types';

export type BriefingSectorHeatCell = {
  key: string;
  name: string;
  symbol: string | null;
  changePercent: number | null;
  /** 표시용 등락(수치 없으면 trend soft) */
  heatPercent: number | null;
  summary: string;
};

const LEADING_SYMBOL_RE =
  /^([A-Z][A-Z0-9.-]{0,14}|\d{6}(?:\.(?:KS|KQ))?)\b/;
const PCT_IN_PARENS_RE = /\(([+-]?\d+(?:\.\d+)?)%\)/;
const PCT_BARE_RE = /([+-]?\d+(?:\.\d+)?)%/;

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

/** summary 앞쪽 티커·등락률 힌트 (예: `SMH 556.53 (-2.18%). …`, `반도체 ETF -9.49%, …`) */
export function parseSectorSummaryQuoteHint(summary: string): {
  symbol: string | null;
  changePercent: number | null;
} {
  const text = String(summary || '').trim();
  if (!text) return { symbol: null, changePercent: null };

  let symbol: string | null = null;
  const lead = text.match(LEADING_SYMBOL_RE);
  if (lead?.[1] && !/^(ETF|ETFS)$/i.test(lead[1])) {
    symbol = lead[1].toUpperCase();
  }

  let changePercent: number | null = null;
  const paren = text.match(PCT_IN_PARENS_RE);
  if (paren?.[1]) {
    const n = Number(paren[1]);
    if (Number.isFinite(n)) changePercent = n;
  } else {
    const bare = text.match(PCT_BARE_RE);
    if (bare?.[1]) {
      const n = Number(bare[1]);
      if (Number.isFinite(n)) changePercent = n;
    }
  }

  return { symbol, changePercent };
}

export function briefingSectorHeatCells(
  sectors: SignalApiMarketBriefingSector[] | null | undefined,
  briefingId: string,
): BriefingSectorHeatCell[] {
  const list = Array.isArray(sectors) ? sectors : [];
  const cells: BriefingSectorHeatCell[] = [];

  for (let index = 0; index < list.length; index += 1) {
    const sector = list[index];
    const name = String(sector?.name || '').trim();
    if (!name) continue;
    const summary = String(sector?.summary || '').trim();
    const hint = parseSectorSummaryQuoteHint(summary);
    const symbol =
      String(sector?.symbol || sector?.etf || '').trim().toUpperCase() || hint.symbol;
    const changePercent = firstFiniteNumber(sector?.changePercent, hint.changePercent);
    const heatPercent = changePercent ?? trendToSoftChangePercent(sector?.trend);
    cells.push({
      key: `${briefingId}-sector-${name}-${index}`,
      name,
      symbol,
      changePercent,
      heatPercent,
      summary,
    });
  }

  return cells.sort((a, b) => (b.heatPercent ?? 0) - (a.heatPercent ?? 0));
}
