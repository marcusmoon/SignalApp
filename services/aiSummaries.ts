import type { FinnhubNewsRaw } from '@/integrations/finnhub/types';
import { isFlashNews } from '@/domain/news';
import type { AppLocale } from '@/locales/messages';
import { messages } from '@/locales/messages';
import { loadLocale } from '@/services/localePreference';
import { loadLlmProvider } from '@/services/llmProviderPreference';
import type { ConcallSummary, NewsItem } from '@/types/signal';
import { formatRelativeFromUnix } from '@/utils/date';

function newsItemFromFinnhubFallback(n: FinnhubNewsRaw, locale: AppLocale): NewsItem {
  const ticker = n.related.split(',')[0]?.trim() || 'GLOBAL';
  return {
    id: String(n.id),
    ticker,
    titleKo: n.headline,
    source: n.source,
    timeLabel: formatRelativeFromUnix(n.datetime, locale),
    url: n.url,
    summarySource: 'finnhub',
    isFlash: isFlashNews(n),
  };
}

export async function translateNewsTitlesWithSelectedProvider(
  articles: FinnhubNewsRaw[],
): Promise<NewsItem[]> {
  const locale = await loadLocale();
  return articles.map((a) => newsItemFromFinnhubFallback(a, locale));
}

export async function summarizeConcallTranscriptSelected(
  ticker: string,
  quarterLabel: string,
  transcript: string,
): Promise<ConcallSummary> {
  const [pref, locale] = await Promise.all([loadLlmProvider(), loadLocale()]);
  const row = messages[locale];
  if (pref === 'none') {
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets:
        locale === 'en'
          ? ['AI features are turned off.', 'You can turn them back on in Settings > Display > AI.']
          : locale === 'ja'
            ? ['AI機能はオフになっています。', '設定 > 表示 > AI で再度オンにできます。']
            : ['AI 기능을 사용하지 않도록 설정했습니다.', '표시 설정의 AI에서 다시 켤 수 있습니다.'],
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }

  void transcript;

  return {
    id: `${ticker}-${quarterLabel}`,
    ticker,
    quarter: quarterLabel,
    bullets: [row.callsAiSignalServerOnly, row.callsAiSignalServerOnlyHint],
    guidance: undefined,
    risk: undefined,
    source: 'fallback',
  };
}
