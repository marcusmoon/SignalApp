import {
  summarizeNewsWithClaude,
  translateNewsTitlesWithClaude,
  summarizeConcallTranscript,
} from '@/services/anthropic';
import { hasAnthropic, hasOpenAI } from '@/services/env';
import { loadLlmProvider } from '@/services/llmProviderPreference';
import type { FinnhubNewsRaw } from '@/services/finnhub';
import {
  summarizeConcallTranscriptOpenAI,
  summarizeNewsWithOpenAI,
  translateNewsTitlesWithOpenAI,
} from '@/services/openaiSummaries';
import type { ConcallSummary, NewsItem } from '@/types/signal';

export async function summarizeNewsWithSelectedProvider(articles: FinnhubNewsRaw[]): Promise<NewsItem[]> {
  const pref = await loadLlmProvider();
  const primaryOpenAI = pref === 'openai' && hasOpenAI();
  const primaryClaude = pref === 'claude' && hasAnthropic();

  if (primaryOpenAI) {
    const r = await summarizeNewsWithOpenAI(articles);
    if (r.some((x) => x.summarySource === 'openai')) return r;
    if (hasAnthropic()) return summarizeNewsWithClaude(articles);
    return r;
  }
  if (primaryClaude) {
    const r = await summarizeNewsWithClaude(articles);
    if (r.some((x) => x.summarySource === 'claude')) return r;
    if (hasOpenAI()) {
      const o = await summarizeNewsWithOpenAI(articles);
      if (o.some((x) => x.summarySource === 'openai')) return o;
    }
    return r;
  }
  if (hasOpenAI()) {
    const o = await summarizeNewsWithOpenAI(articles);
    if (o.some((x) => x.summarySource === 'openai')) return o;
  }
  return summarizeNewsWithClaude(articles);
}

export async function translateNewsTitlesWithSelectedProvider(
  articles: FinnhubNewsRaw[],
): Promise<NewsItem[]> {
  const pref = await loadLlmProvider();
  if (pref === 'openai' && hasOpenAI()) {
    return translateNewsTitlesWithOpenAI(articles);
  }
  if (pref === 'claude' && hasAnthropic()) {
    return translateNewsTitlesWithClaude(articles);
  }
  if (pref === 'openai' && hasAnthropic()) {
    return translateNewsTitlesWithClaude(articles);
  }
  if (pref === 'claude' && hasOpenAI()) {
    return translateNewsTitlesWithOpenAI(articles);
  }
  if (hasOpenAI()) return translateNewsTitlesWithOpenAI(articles);
  return translateNewsTitlesWithClaude(articles);
}

export async function summarizeConcallTranscriptSelected(
  ticker: string,
  quarterLabel: string,
  transcript: string,
): Promise<ConcallSummary> {
  const pref = await loadLlmProvider();
  if (pref === 'openai') {
    if (hasOpenAI()) {
      const r = await summarizeConcallTranscriptOpenAI(ticker, quarterLabel, transcript);
      if (r.source === 'openai') return r;
    }
    if (hasAnthropic()) {
      return summarizeConcallTranscript(ticker, quarterLabel, transcript);
    }
    return summarizeConcallTranscriptOpenAI(ticker, quarterLabel, transcript);
  }
  if (hasAnthropic()) {
    const r = await summarizeConcallTranscript(ticker, quarterLabel, transcript);
    if (r.source === 'claude') return r;
  }
  if (hasOpenAI()) {
    return summarizeConcallTranscriptOpenAI(ticker, quarterLabel, transcript);
  }
  return summarizeConcallTranscript(ticker, quarterLabel, transcript);
}
