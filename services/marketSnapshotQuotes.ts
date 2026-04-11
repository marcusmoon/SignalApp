import type { MessageId } from '@/locales/messages';
import {
  fetchQuote,
  fetchUsdKrwQuoteApprox,
  finnhubQuoteHasValidPrice,
  type FinnhubQuote,
} from '@/services/finnhub';

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
 * 시장 요약 카드용 — 지수 테이프 + 매크로 ETF/FX 시세.
 */
export async function loadMarketSnapshotQuotes(): Promise<{
  tape: Record<string, FinnhubQuote | null>;
  macro: Record<string, FinnhubQuote | null>;
}> {
  const tapeSet = new Set<string>([...MARKET_SNAPSHOT_TAPE_SYMBOLS]);
  const macroSyms = MARKET_SNAPSHOT_MACRO_ROWS.map((r) => r.symbol);
  const allSyms = [...MARKET_SNAPSHOT_TAPE_SYMBOLS, ...macroSyms];

  const quotes = await Promise.all(
    allSyms.map(async (sym) => {
      try {
        if (sym === 'OANDA:USD_KRW') {
          const raw = await fetchUsdKrwQuoteApprox();
          const q = raw && finnhubQuoteHasValidPrice(raw) ? raw : null;
          return { sym, q };
        }
        const raw = await fetchQuote(sym);
        const q = finnhubQuoteHasValidPrice(raw) ? (raw as FinnhubQuote) : null;
        return { sym, q };
      } catch {
        return { sym, q: null as FinnhubQuote | null };
      }
    }),
  );

  const tape: Record<string, FinnhubQuote | null> = {};
  const macro: Record<string, FinnhubQuote | null> = {};
  for (const { sym, q } of quotes) {
    if (tapeSet.has(sym)) {
      tape[sym] = q;
    } else {
      macro[sym] = q;
    }
  }
  return { tape, macro };
}
