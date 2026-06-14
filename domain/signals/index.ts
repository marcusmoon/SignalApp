import type { SignalApiMarketQuote, SignalApiNewsItem } from '@/integrations/signal-api/types';

export type SignalScoreInput = {
  symbol: string;
  quote?: SignalApiMarketQuote | null;
  news?: SignalApiNewsItem[];
  vsSmaPct?: number | null;
};

export type SignalScore = {
  symbol: string;
  score: number;
  level: 'quiet' | 'watch' | 'hot';
  reasons: string[];
  newsCount: number;
  absMovePct: number;
};

function effectiveMovePct(q?: SignalApiMarketQuote | null): number {
  if (!q) return 0;
  const dp = Number(q.changePercent);
  if (Number.isFinite(dp)) return dp;
  const c = Number(q.currentPrice);
  const pc = Number(q.previousClose);
  if (Number.isFinite(c) && Number.isFinite(pc) && pc !== 0) {
    return ((c - pc) / pc) * 100;
  }
  return 0;
}

export function buildSignalScore(input: SignalScoreInput): SignalScore {
  const newsCount = input.news?.length ?? 0;
  const movePct = effectiveMovePct(input.quote);
  const absMovePct = Math.abs(movePct);
  const absSma = Math.abs(input.vsSmaPct ?? 0);
  const reasons: string[] = [];

  let score = 0;
  if (newsCount >= 6) {
    score += 28;
    reasons.push('news_dense');
  } else if (newsCount >= 3) {
    score += 18;
    reasons.push('news_active');
  } else if (newsCount > 0) {
    score += 8;
  }

  if (absMovePct >= 5) {
    score += 30;
    reasons.push(movePct >= 0 ? 'price_surge' : 'price_drop');
  } else if (absMovePct >= 2) {
    score += 18;
    reasons.push('price_move');
  } else if (absMovePct >= 1) {
    score += 8;
  }

  if (absSma >= 8) {
    score += 18;
    reasons.push('sma_stretched');
  } else if (absSma >= 4) {
    score += 10;
  }

  const capped = Math.min(100, Math.round(score));
  return {
    symbol: input.symbol,
    score: capped,
    level: capped >= 55 ? 'hot' : capped >= 25 ? 'watch' : 'quiet',
    reasons,
    newsCount,
    absMovePct,
  };
}
