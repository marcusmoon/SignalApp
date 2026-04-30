import type { FinnhubEarningsRow, FinnhubNewsRaw, FinnhubQuote } from '@/integrations/finnhub/types';

export type SignalScoreInput = {
  symbol: string;
  quote?: FinnhubQuote | null;
  news?: FinnhubNewsRaw[];
  nextEarning?: FinnhubEarningsRow | null;
  vsSmaPct?: number | null;
  todayYmd: string;
};

export type SignalScore = {
  symbol: string;
  score: number;
  level: 'quiet' | 'watch' | 'hot';
  reasons: string[];
  newsCount: number;
  absMovePct: number;
};

function daysBetweenYmd(a: string, b: string): number | null {
  const ma = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const mb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!ma || !mb) return null;
  const da = Date.UTC(Number(ma[1]), Number(ma[2]) - 1, Number(ma[3]));
  const db = Date.UTC(Number(mb[1]), Number(mb[2]) - 1, Number(mb[3]));
  return Math.round((db - da) / 86_400_000);
}

function effectiveMovePct(q?: FinnhubQuote | null): number {
  if (!q) return 0;
  if (Number.isFinite(q.dp)) return q.dp;
  if (Number.isFinite(q.c) && Number.isFinite(q.pc) && q.pc !== 0) {
    return ((q.c - q.pc) / q.pc) * 100;
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

  if (input.nextEarning?.date) {
    const days = daysBetweenYmd(input.todayYmd, input.nextEarning.date);
    if (days != null && days >= 0 && days <= 7) {
      score += 18;
      reasons.push('earnings_soon');
    } else if (days != null && days >= 0 && days <= 21) {
      score += 8;
    }
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
