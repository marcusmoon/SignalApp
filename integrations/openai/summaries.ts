import type { FinnhubNewsRaw } from '@/integrations/finnhub/types';
import { newsItemFromFinnhubFallback } from '@/integrations/anthropic';
import { isOpenAiConfigured, postOpenAiChatCompletion } from '@/integrations/openai/client';
import { messages as appMessages, type AppLocale } from '@/locales/messages';
import type { ConcallSummary, NewsItem } from '@/types/signal';

function localeLabel(locale: AppLocale): string {
  if (locale === 'en') return 'English';
  if (locale === 'ja') return 'Japanese';
  return 'Korean';
}

function localizedConcallFallback(
  locale: AppLocale,
  kind: 'missing_key' | 'parse_failed' | 'empty',
): [string, string] {
  const row = appMessages[locale];
  const dash = '—';
  if (kind === 'missing_key') return [row.callsAiOpenaiKeyMissing, dash];
  if (kind === 'parse_failed') return [row.callsAiSummaryParseFailedTitle, row.callsAiSummaryParseFailedHint];
  return [row.callsAiSummaryGenerateFailed, dash];
}

async function translateNewsTitleWithOpenAI(article: FinnhubNewsRaw, locale: AppLocale): Promise<string | null> {
  try {
    const system =
      `Translate the following financial news headline into concise natural ${localeLabel(locale)}. Return ONLY the translated headline text in ${localeLabel(locale)}.`;
    const user = `Headline: ${article.headline}`;
    const text = (await postOpenAiChatCompletion(system, user, 256)).trim();
    if (!text) return null;
    return text.replace(/^["'`]+|["'`]+$/g, '').trim() || null;
  } catch (error) {
    if (__DEV__) {
      console.warn('[translateNewsTitleWithOpenAI]', article.id, error);
    }
    return null;
  }
}

export async function translateNewsTitlesWithOpenAI(
  articles: FinnhubNewsRaw[],
  locale: AppLocale,
): Promise<NewsItem[]> {
  return Promise.all(
    articles.map(async (article) => {
      const fallback = newsItemFromFinnhubFallback(article, locale);
      const titleKo = await translateNewsTitleWithOpenAI(article, locale);
      return {
        ...fallback,
        titleKo: titleKo || fallback.titleKo,
        summarySource: titleKo ? 'openai' : fallback.summarySource,
      };
    }),
  );
}

type ConcallJson = {
  bullets: [string, string];
  guidance: string;
  risk: string;
};

export async function summarizeConcallTranscriptOpenAI(
  ticker: string,
  quarterLabel: string,
  transcript: string,
  locale: AppLocale,
): Promise<ConcallSummary> {
  const clipped = transcript.slice(0, 24_000);
  if (!isOpenAiConfigured()) {
    const bullets = localizedConcallFallback(locale, 'missing_key');
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets,
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }

  const system =
    `You summarize earnings call transcripts for investors. Return ONLY valid JSON: {"bullets":[two ${localeLabel(locale)} strings],"guidance":"${localeLabel(locale)} one sentence or empty","risk":"${localeLabel(locale)} one sentence or empty"}.`;

  const user = `Ticker ${ticker}, quarter ${quarterLabel}.\nTranscript:\n${clipped}`;

  let obj: ConcallJson;
  try {
    const text = await postOpenAiChatCompletion(system, user, 4096);
    obj = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as ConcallJson;
  } catch {
    const bullets = localizedConcallFallback(locale, 'parse_failed');
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets,
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }
  const bulletsRaw = Array.isArray(obj.bullets) ? obj.bullets.map((x) => String(x)) : [];
  const bullets =
    bulletsRaw.length >= 2
      ? [bulletsRaw[0], bulletsRaw[1]]
      : [bulletsRaw[0] ?? localizedConcallFallback(locale, 'empty')[0], bulletsRaw[1] ?? localizedConcallFallback(locale, 'empty')[1]];

  return {
    id: `${ticker}-${quarterLabel}`,
    ticker,
    quarter: quarterLabel,
    bullets,
    guidance: obj.guidance || undefined,
    risk: obj.risk || undefined,
    source: 'openai',
  };
}
