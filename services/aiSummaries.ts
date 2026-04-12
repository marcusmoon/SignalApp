import {
  newsItemFromFinnhubFallback,
  summarizeConcallTranscript,
  translateNewsTitlesWithClaude,
} from '@/integrations/anthropic';
import type { FinnhubNewsRaw } from '@/integrations/finnhub';
import { hasAnthropic, hasOpenAI } from '@/services/env';
import { loadLocale } from '@/services/localePreference';
import { loadLlmProvider } from '@/services/llmProviderPreference';
import {
  summarizeConcallTranscriptOpenAI,
  translateNewsTitlesWithOpenAI,
} from '@/integrations/openai/summaries';
import type { ConcallSummary, NewsItem } from '@/types/signal';

export async function translateNewsTitlesWithSelectedProvider(
  articles: FinnhubNewsRaw[],
): Promise<NewsItem[]> {
  const [pref, locale] = await Promise.all([loadLlmProvider(), loadLocale()]);
  if (pref === 'none') {
    return articles.map((a) => newsItemFromFinnhubFallback(a, locale));
  }
  if (pref === 'openai' && hasOpenAI()) {
    return translateNewsTitlesWithOpenAI(articles, locale);
  }
  if (pref === 'claude' && hasAnthropic()) {
    return translateNewsTitlesWithClaude(articles, locale);
  }
  return articles.map((a) => newsItemFromFinnhubFallback(a, locale));
}

export async function summarizeConcallTranscriptSelected(
  ticker: string,
  quarterLabel: string,
  transcript: string,
): Promise<ConcallSummary> {
  const [pref, locale] = await Promise.all([loadLlmProvider(), loadLocale()]);
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
  if (pref === 'openai') {
    if (hasOpenAI()) {
      const r = await summarizeConcallTranscriptOpenAI(ticker, quarterLabel, transcript, locale);
      if (r.source === 'openai') return r;
    }
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets:
        locale === 'en'
          ? ['ChatGPT is selected, but no API key was found.', 'Choose Off or another provider in Settings > Display > AI.']
          : locale === 'ja'
            ? ['ChatGPT が選択されていますが、APIキーが見つかりません。', '設定 > 表示 > AI で使用しないか他の提供元を選んでください。']
            : ['ChatGPT를 선택했지만 API 키를 찾지 못했습니다.', '표시 설정의 AI에서 사용 안함 또는 다른 제공자를 선택해 주세요.'],
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }
  if (hasAnthropic()) {
    const r = await summarizeConcallTranscript(ticker, quarterLabel, transcript, locale);
    if (r.source === 'claude') return r;
  }
  return {
    id: `${ticker}-${quarterLabel}`,
    ticker,
    quarter: quarterLabel,
    bullets:
      locale === 'en'
        ? ['Claude is selected, but no API key was found.', 'Choose Off or another provider in Settings > Display > AI.']
        : locale === 'ja'
          ? ['Claude が選択されていますが、APIキーが見つかりません。', '設定 > 表示 > AI で使用しないか他の提供元を選んでください。']
          : ['Claude를 선택했지만 API 키를 찾지 못했습니다.', '표시 설정의 AI에서 사용 안함 또는 다른 제공자를 선택해 주세요.'],
    guidance: undefined,
    risk: undefined,
    source: 'fallback',
  };
}
