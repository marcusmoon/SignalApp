import { trendToSoftChangePercent } from '@/domain/heatmaps/changeHeat';
import type { SignalApiMarketBriefingSector } from '@/integrations/signal-api/types';

export type BriefingSectorHeatCell = {
  key: string;
  name: string;
  symbol: string | null;
  changePercent: number | null;
  /** 채색용 등락(수치 없으면 trend soft) */
  heatPercent: number | null;
  /** 원본 trend (수치 없을 때 칩 라벨) */
  trend: string | null;
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

/**
 * 히트맵이 이미 담는 시세·등락 프리앰블을 제거하고 "왜" 문장만 남긴다.
 * 예: `SMH 556.53 (-2.18%). AI 지출…` → `AI 지출…`
 * 예: `반도체 ETF -9.49%, 삼성전자 -8.77%. 미국 SOX…` → `미국 SOX…`
 */
export function stripSectorSummaryQuotePreamble(summary: string): string {
  const text = String(summary || '').trim();
  if (!text) return '';

  const sentenceSplit = text.match(/^(.+?[.。])\s+([\s\S]+)$/);
  if (sentenceSplit?.[2]) {
    const lead = sentenceSplit[1];
    const rest = sentenceSplit[2].trim();
    if (/%/.test(lead) && rest.length >= 8) return rest;
  }

  const usLead = text
    .replace(
      /^[A-Z][A-Z0-9.-]{0,14}\s+[\d,.]+(?:\s*\([+-]?\d+(?:\.\d+)?%\))?[.。]?\s*/,
      '',
    )
    .trim();
  if (usLead && usLead !== text && usLead.length >= 8) return usLead;

  return text;
}

/** 히트맵 아래에 따로 보여줄 "왜"가 있는지 */
export function sectorSummaryWhyText(summary: string | null | undefined): string {
  const stripped = stripSectorSummaryQuotePreamble(String(summary || ''));
  if (!stripped) return '';
  // 시세 나열만 남은 경우(왜 문장 없음)는 숨김
  if (/^[\w가-힣.%+\-,\s]+$/.test(stripped) && !/[가-힣A-Za-z]{4,}/.test(stripped.replace(/%/g, ''))) {
    return '';
  }
  // 전체가 여전히 짧은 시세 조각이면 스킵
  if (stripped.length < 12 && /%/.test(stripped)) return '';
  return stripped;
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
    const trend = String(sector?.trend || '').trim() || null;
    const changePercent = firstFiniteNumber(sector?.changePercent, hint.changePercent);
    const heatPercent = changePercent ?? trendToSoftChangePercent(trend);
    cells.push({
      key: `${briefingId}-sector-${name}-${index}`,
      name,
      symbol,
      changePercent,
      heatPercent,
      trend,
      summary,
    });
  }

  return cells.sort((a, b) => (b.heatPercent ?? 0) - (a.heatPercent ?? 0));
}
