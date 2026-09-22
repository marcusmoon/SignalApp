import type { SignalApiDisclosure, SignalApiMarketBriefing, SignalApiNewsDigestItem } from '../../integrations/signal-api/types.ts';
import type { NewsItem } from '../../types/signal.ts';
import { matchingWatchSymbols } from '../home/newsReading.ts';

export type CompanyTimelineRow = {
  id: string; kind: 'news' | 'issue' | 'briefing' | 'filing'; title: string;
  summary?: string; at: string | null; url?: string; route?: string; source?: string;
};

export function companyTimeline(symbol: string, news: NewsItem[], filings: SignalApiDisclosure[], issues: SignalApiNewsDigestItem[], briefings: SignalApiMarketBriefing[]): CompanyTimelineRow[] {
  const relevantIssues = issues.filter((item) => matchingWatchSymbols(item, [symbol]).length);
  const coveredNews = new Set(relevantIssues.flatMap((item) => item.sourceRefs.map((ref) => ref.id)));
  const rows: CompanyTimelineRow[] = [
    ...relevantIssues.map((item): CompanyTimelineRow => ({ id: `issue:${item.id}`, kind: 'issue', title: item.title,
      summary: item.changeType === 'update' || item.changeType === 'correction' ? item.changes?.map((change) => change.text).join(' ') || item.summary : item.summary,
      at: item.generatedAt, route: `/news-digest?id=${encodeURIComponent(item.id)}` })),
    ...news.filter((item) => !coveredNews.has(item.id)).map((item): CompanyTimelineRow => ({ id: `news:${item.id}`, kind: 'news', title: item.titleKo, at: item.publishedAt || null, url: item.url, source: item.source })),
    ...filings.map((item): CompanyTimelineRow => ({ id: `filing:${item.id}`, kind: 'filing', title: item.title, summary: item.summary || undefined, at: item.filedAt, route: `/disclosures/${encodeURIComponent(item.id)}` })),
    ...briefings.flatMap((item): CompanyTimelineRow[] => {
      const company = item.companies.find((row) => matchingWatchSymbols({ symbols: [row.symbol] }, [symbol]).length);
      return company ? [{ id: `briefing:${item.id}`, kind: 'briefing', title: company.summary, at: item.publishedAt || item.createdAt, route: `/market-briefing?id=${encodeURIComponent(item.id)}` }] : [];
    }),
  ];
  const seen = new Set<string>();
  return rows.sort((a, b) => (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0) || a.id.localeCompare(b.id))
    .filter((row) => !seen.has(row.id) && Boolean(seen.add(row.id))).slice(0, 16);
}
