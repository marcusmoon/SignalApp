import type { MessageId } from '@/locales/messages';
import { finnhubQuoteHasValidPrice } from '@/integrations/finnhub/quoteUtils';
import type { FinnhubQuote } from '@/integrations/finnhub/types';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { signalMarketQuoteToFinnhubQuote } from '@/integrations/signal-api/finnhubShim';
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
  tape: Record<string, FinnhubQuote | null>;
  macro: Record<string, FinnhubQuote | null>;
}> {
  const tapeSyms = [...MARKET_SNAPSHOT_TAPE_SYMBOLS];
  const macroSyms = MARKET_SNAPSHOT_MACRO_ROWS.map((r) => r.symbol);
  const tapeSet = new Set<string>(tapeSyms);
  const outTape: Record<string, FinnhubQuote | null> = {};
  const outMacro: Record<string, FinnhubQuote | null> = {};
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
  let rows = await fetchSignalMarketQuotes({ symbols: uniq, pageSize: uniq.length }).catch(() => []);
  const map = new Map(rows.map((r) => [String(r.symbol || '').trim().toUpperCase(), r] as const));
  for (const sym of uniq) {
    const row = map.get(sym);
    let q: FinnhubQuote | null = null;
    if (row) {
      const conv = signalMarketQuoteToFinnhubQuote(row);
      q = finnhubQuoteHasValidPrice(conv) ? conv : null;
    }
    if (tapeSet.has(sym)) outTape[sym] = q;
    else outMacro[sym] = q;
  }
  return { tape: outTape, macro: outMacro };
}
