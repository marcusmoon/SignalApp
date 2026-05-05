import type { SignalApiInsight, SignalApiInsightSourceRef } from '@/integrations/signal-api/types';

function isGoogleJumpOrNewsHost(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === 'news.google.com' || h === 'news.google.co.kr' || h === 'news.google.co.jp') return true;
    if ((h === 'www.google.com' || h === 'google.com') && u.pathname.startsWith('/url')) return true;
    return false;
  } catch {
    return /news\.google\./i.test(url) || /google\.com\/url\?/i.test(url);
  }
}

/** Prefer a direct article/video URL; RSS·aggregator sometimes stores Google News / google.com/url?q=… */
export function primaryInsightSourceRef(insight: SignalApiInsight): SignalApiInsightSourceRef | undefined {
  const refs = (insight.sourceRefs ?? []).filter((r) => typeof r.url === 'string' && r.url.trim().length > 0);
  if (refs.length === 0) return undefined;
  const direct = refs.find((r) => !isGoogleJumpOrNewsHost(String(r.url)));
  return direct ?? refs[0];
}
