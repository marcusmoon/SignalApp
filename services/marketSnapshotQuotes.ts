import type { MessageId } from '@/locales/messages';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import type { SignalApiMarketQuote } from '@/integrations/signal-api/types';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { hasSignalApi } from '@/services/env';

export type MacroRowDef = { key: MessageId; symbol: string };

export const MARKET_SNAPSHOT_TAPE_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA', 'VIXY'] as const;

export const MARKET_SNAPSHOT_MACRO_ROWS: MacroRowDef[] = [
  { key: 'marketMacroDxy', symbol: 'UUP' },
  { key: 'marketMacroRates', symbol: 'IEF' },
  { key: 'marketMacroUsdKrw', symbol: 'OANDA:USD_KRW' },
  { key: 'marketMacroOil', symbol: 'USO' },
  { key: 'marketMacroGold', symbol: 'GLD' },
];

/**
 * 시장 요약 카드용 — 지수 테이프 + 매크로 ETF/FX 시세 (`/v1/market-quotes` 일괄).
 */
export async function loadMarketSnapshotQuotes(): Promise<{
  tape: Record<string, SignalApiMarketQuote | null>;
  macro: Record<string, SignalApiMarketQuote | null>;
}> {
  const tapeSyms = [...MARKET_SNAPSHOT_TAPE_SYMBOLS];
  const macroSyms = MARKET_SNAPSHOT_MACRO_ROWS.map((r) => r.symbol);
  const tapeSet = new Set<string>(tapeSyms);
  const outTape: Record<string, SignalApiMarketQuote | null> = {};
  const outMacro: Record<string, SignalApiMarketQuote | null> = {};
  tapeSyms.forEach((s) => {
    outTape[s] = null;
  });
  macroSyms.forEach((s) => {
    outMacro[s] = null;
  });

  if (!hasSignalApi()) {
    return { tape: outTape, macro: outMacro };
  }

  const uniq = [...new Set([...tapeSyms, ...macroSyms])];
  const rows = await fetchSignalMarketQuotes({ symbols: uniq, pageSize: uniq.length }).catch(() => []);
  const map = new Map(rows.map((r) => [String(r.symbol || '').trim().toUpperCase(), r] as const));
  for (const sym of uniq) {
    const row = map.get(sym);
    const q = row && signalMarketQuoteHasValidPrice(row) ? row : null;
    if (tapeSet.has(sym)) outTape[sym] = q;
    else outMacro[sym] = q;
  }
  return { tape: outTape, macro: outMacro };
}
