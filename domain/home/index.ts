import type {
  SignalApiInsight,
  SignalApiMarketQuote,
  SignalApiNewsItem,
} from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';

export const HOME_RELATED_NEWS_LIMIT = 5;
export const HOME_RELATED_NEWS_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const HOME_RELATED_VIDEO_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function homeRelatedNewsFromIso(): string {
  const fromMs = Date.now() - HOME_RELATED_NEWS_MAX_AGE_MS;
  const hourMs = 60 * 60 * 1000;
  return new Date(Math.floor(fromMs / hourMs) * hourMs).toISOString();
}

function isoMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isRecentIso(iso: string | null | undefined, maxAgeMs: number): boolean {
  const ms = isoMs(iso);
  if (ms == null) return false;
  const age = Date.now() - ms;
  return age >= 0 && age <= maxAgeMs;
}

function formatUsdBody(abs: number): string {
  if (!Number.isFinite(abs) || abs < 0) return '—';
  if (abs >= 1000) return abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return abs.toFixed(2);
  if (abs >= 0.0001) return abs.toFixed(6);
  return abs.toFixed(8);
}

export function formatUsd(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${formatUsdBody(Math.abs(n))}`;
}

export function formatPct(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatUsdChange(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0.00';
  const sign = n > 0 ? '+' : '-';
  return `${sign}$${formatUsdBody(Math.abs(n))}`;
}

export function driverText(insight: SignalApiInsight): string {
  return (
    insight.whyNow ||
    insight.reasoning?.[0] ||
    insight.signalDrivers?.[0] ||
    insight.summary ||
    insight.title
  );
}

export function marketMood(insights: SignalApiInsight[], quotes: SignalApiMarketQuote[]): 'quiet' | 'watch' | 'active' {
  if (insights.some((item) => item.level === 'alert' || item.pushPriority === 'high')) return 'active';
  const maxMove = Math.max(
    0,
    ...quotes.map((quote) => Math.abs(Number(quote.changePercent))).filter((n) => Number.isFinite(n)),
  );
  if (maxMove >= 3 || insights.length >= 2) return 'watch';
  return 'quiet';
}

export function moodMessageId(mood: ReturnType<typeof marketMood>): MessageId {
  if (mood === 'active') return 'homeMoodActive';
  if (mood === 'watch') return 'homeMoodWatch';
  return 'homeMoodQuiet';
}

export function homeHeadline(params: {
  insights: SignalApiInsight[];
  quotes: SignalApiMarketQuote[];
  fallback: string;
  pulseHeadline: string;
  pulseQuiet: string;
}): string {
  const quotes = params.quotes.filter((row) => typeof row.changePercent === 'number' && Number.isFinite(row.changePercent));
  const moverCount = quotes.filter((row) => Math.abs(Number(row.changePercent)) >= 1).length;
  if (quotes.length > 0) return moverCount > 0 ? params.pulseHeadline : params.pulseQuiet;
  const insight = params.insights[0];
  if (insight?.title) return insight.title;
  return params.fallback;
}

export function normalizeSymbolSet(symbols: string[]): Set<string> {
  return new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
}

export function addUniqueEvidence<T extends { key: string; url?: string }>(
  rows: T[],
  seen: Set<string>,
  row: T,
  max: number,
): void {
  if (rows.length >= max) return;
  const key = row.url?.trim() || row.key;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
}

export function symbolNewsCount(rawNews: SignalApiNewsItem[], symbol: string): number {
  const target = symbol.trim().toUpperCase();
  if (!target) return 0;
  return rawNews.filter((item) => {
    const symbols = Array.isArray(item.symbols) ? item.symbols : [];
    return symbols.some((s) => s.trim().toUpperCase() === target);
  }).length;
}

export function symbolSignalCount(insights: SignalApiInsight[], symbol: string): number {
  const target = symbol.trim().toUpperCase();
  if (!target) return 0;
  return insights.filter((item) => {
    const symbols = Array.isArray(item.symbols) ? item.symbols : [];
    return symbols.some((s) => s.trim().toUpperCase() === target);
  }).length;
}

export function quoteReasonCode(quote: SignalApiMarketQuote): string {
  const pct = Number(quote.changePercent);
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.2) return 'quiet';
  if (Math.abs(pct) >= 3) return pct > 0 ? 'price_surge' : 'price_drop';
  return 'price_move';
}

export function watchReasonLabelId(code: string): MessageId {
  switch (code) {
    case 'price_surge':
      return 'homeWatchReasonPriceSurge';
    case 'price_drop':
      return 'homeWatchReasonPriceDrop';
    case 'price_move':
      return 'homeWatchReasonPriceMove';
    case 'news_dense':
      return 'homeWatchReasonNewsDense';
    case 'news_active':
      return 'homeWatchReasonNewsActive';
    case 'insight_alert':
      return 'homeWatchReasonInsightAlert';
    case 'insight_watch':
      return 'homeWatchReasonInsightWatch';
    case 'video_active':
      return 'homeWatchReasonVideoActive';
    case 'earnings_soon':
      return 'homeWatchReasonEarningsSoon';
    case 'event_soon':
      return 'homeWatchReasonEventSoon';
    default:
      return 'homeWatchReasonQuiet';
  }
}
