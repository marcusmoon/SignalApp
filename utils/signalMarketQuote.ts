import type { SignalApiMarketQuote } from '@/integrations/signal-api/types';

export function signalMarketQuoteHasValidPrice(q: unknown): boolean {
  if (!q || typeof q !== 'object') return false;
  const p = (q as SignalApiMarketQuote).currentPrice;
  return typeof p === 'number' && Number.isFinite(p);
}
