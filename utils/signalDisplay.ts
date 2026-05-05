import type { MessageId } from '@/locales/messages';
import type { SignalApiMarketQuote } from '@/integrations/signal-api/types';

type Translate = (id: MessageId, vars?: Record<string, string | number>) => string;

export function signalQuoteMovePct(q?: SignalApiMarketQuote | null): number {
  if (!q) return Number.NaN;
  const dp = Number(q.changePercent);
  if (Number.isFinite(dp)) return dp;
  const current = Number(q.currentPrice);
  const previous = Number(q.previousClose);
  if (Number.isFinite(current) && Number.isFinite(previous) && previous !== 0) {
    return ((current - previous) / previous) * 100;
  }
  return Number.NaN;
}

export function signalReasonMessageId(reason: string): MessageId {
  if (reason === 'news_dense') return 'signalReasonNewsDense';
  if (reason === 'news_active') return 'signalReasonNewsActive';
  if (reason === 'price_surge') return 'signalReasonPriceSurge';
  if (reason === 'price_drop') return 'signalReasonPriceDrop';
  if (reason === 'price_move') return 'signalReasonPriceMove';
  if (reason === 'sma_stretched') return 'signalReasonSmaStretched';
  if (reason === 'earnings_soon') return 'signalReasonEarningsSoon';
  return 'signalReasonWatch';
}

export function signalReasonLabel(reason: string, t: Translate): string {
  return t(signalReasonMessageId(reason));
}

