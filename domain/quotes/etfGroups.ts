/**
 * 시세 ETF 목록 그룹 — 큐레이션 저장순을 유지한 채 연속 구간 헤더용.
 * AUM 정렬 아님.
 */

export const ETF_QUOTE_GROUP_KEYS = ['broad', 'sector', 'macro'] as const;
export type EtfQuoteGroupKey = (typeof ETF_QUOTE_GROUP_KEYS)[number];

const BROAD = new Set(['SPY', 'QQQ', 'IWM', 'DIA']);
const SECTOR_EXTRA = new Set(['SMH', 'SOXX']);

export function etfQuoteGroupForSymbol(raw: string): EtfQuoteGroupKey {
  const symbol = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (BROAD.has(symbol)) return 'broad';
  if (SECTOR_EXTRA.has(symbol) || /^XL[A-Z0-9]*$/.test(symbol)) return 'sector';
  return 'macro';
}

export type EtfQuoteListEntry<T extends { symbol: string }> =
  | { type: 'header'; group: EtfQuoteGroupKey }
  | { type: 'row'; row: T };

/** 저장순 유지. 그룹이 바뀔 때만 헤더 삽입(연속 런). */
export function insertEtfQuoteGroupHeaders<T extends { symbol: string }>(
  rows: readonly T[],
): EtfQuoteListEntry<T>[] {
  const out: EtfQuoteListEntry<T>[] = [];
  let prev: EtfQuoteGroupKey | null = null;
  for (const row of rows) {
    const group = etfQuoteGroupForSymbol(row.symbol);
    if (group !== prev) {
      out.push({ type: 'header', group });
      prev = group;
    }
    out.push({ type: 'row', row });
  }
  return out;
}
