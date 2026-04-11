import type { FinnhubNewsRaw } from '@/services/finnhub';
import type { AppLocale } from '@/locales/messages';
import { newsItemFromFinnhubFallback } from '@/services/anthropic';
import { openaiChatCompletion } from '@/services/openaiChat';
import { hasOpenAI } from '@/services/env';
import type { ConcallSummary, NewsItem } from '@/types/signal';
import { formatRelativeFromUnix } from '@/utils/date';
import { isFlashNews } from '@/services/newsFlash';

function localeLabel(locale: AppLocale): string {
  if (locale === 'en') return 'English';
  if (locale === 'ja') return 'Japanese';
  return 'Korean';
}

function localizedConcallFallback(locale: AppLocale, kind: 'missing_key' | 'parse_failed' | 'empty'): [string, string] {
  if (locale === 'en') {
    if (kind === 'missing_key') return ['An OpenAI API key is required for AI call summaries.', '—'];
    if (kind === 'parse_failed') return ['The AI summary response could not be parsed.', 'Please check the transcript manually.'];
    return ['The summary could not be generated.', '—'];
  }
  if (locale === 'ja') {
    if (kind === 'missing_key') return ['AIコール要約には OpenAI API キーが必要です。', '—'];
    if (kind === 'parse_failed') return ['AI要約の応答を解析できませんでした。', 'トランスクリプトを直接確認してください。'];
    return ['要約を生成できませんでした。', '—'];
  }
  if (kind === 'missing_key') return ['트랜스크립트 요약을 위해 OpenAI API 키가 필요합니다.', '—'];
  if (kind === 'parse_failed') return ['요약 JSON 파싱에 실패했습니다.', '트랜스크립트 앞부분만 확인해 주세요.'];
  return ['요약을 생성하지 못했습니다.', '—'];
}

async function translateNewsTitleWithOpenAI(article: FinnhubNewsRaw, locale: AppLocale): Promise<string | null> {
  try {
    const system =
      `Translate the following financial news headline into concise natural ${localeLabel(locale)}. Return ONLY the translated headline text in ${localeLabel(locale)}.`;
    const user = `Headline: ${article.headline}`;
    const text = (await openaiChatCompletion(system, user, 256)).trim();
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
      const fallback = newsItemFromFinnhubFallback(article);
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
  if (!hasOpenAI()) {
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
    const text = await openaiChatCompletion(system, user, 4096);
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
