import type { FinnhubNewsRaw } from '@/services/finnhub';
import { newsItemFromFinnhubFallback } from '@/services/anthropic';
import { openaiChatCompletion } from '@/services/openaiChat';
import { hasOpenAI } from '@/services/env';
import type { ConcallSummary, NewsItem } from '@/types/signal';
import { formatRelativeFromUnix } from '@/utils/date';
import { isFlashNews } from '@/services/newsFlash';

function extractJsonArray<T>(raw: string): T[] {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1].trim() : trimmed;
  const candidates = [
    jsonStr,
    jsonStr.slice(Math.max(0, jsonStr.indexOf('[')), jsonStr.lastIndexOf(']') + 1),
  ].filter((candidate, index, arr) => candidate.length > 0 && arr.indexOf(candidate) === index);

  let parsed: unknown = null;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate) as unknown;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return parsed as T[];
}

function splitToThreeLines(text: string): [string, string, string] {
  const t = text.replace(/\s+/g, ' ').trim();
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const a = parts[0] ?? t.slice(0, 120);
  const b = parts[1] ?? '\ucd94\uac00 \ub9e5\ub77d\uc740 \uc6d0\ubb38\uc744 \ucc38\uace0\ud558\uc138\uc694.';
  const c = parts[2] ?? '\u2014';
  return [a, b, c];
}

function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text);
}

type NewsBatchRow = {
  id: string;
  titleKo: string;
  ticker: string;
  summaryLines: [string, string, string];
};

const NEWS_BATCH_SIZE = 4;

async function translateNewsTitleWithOpenAI(article: FinnhubNewsRaw): Promise<string | null> {
  try {
    const system =
      'Translate the following financial news headline into concise natural Korean. Return ONLY the translated Korean headline text.';
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

export async function translateNewsTitlesWithOpenAI(articles: FinnhubNewsRaw[]): Promise<NewsItem[]> {
  return Promise.all(
    articles.map(async (article) => {
      const fallback = newsItemFromFinnhubFallback(article);
      const titleKo = await translateNewsTitleWithOpenAI(article);
      return {
        ...fallback,
        titleKo: titleKo || fallback.titleKo,
        summaryLines: ['', '', ''],
        summarySource: titleKo ? 'openai' : fallback.summarySource,
      };
    }),
  );
}

async function buildFallbackNewsItemWithOpenAITitle(article: FinnhubNewsRaw): Promise<NewsItem> {
  const fallback = newsItemFromFinnhubFallback(article);
  const titleKo = await translateNewsTitleWithOpenAI(article);
  return {
    ...fallback,
    titleKo: titleKo || fallback.titleKo,
    summarySource: titleKo ? 'openai' : fallback.summarySource,
  };
}

async function ensureKoreanTitleWithOpenAI(article: FinnhubNewsRaw, candidate?: string | null): Promise<string> {
  const normalized = String(candidate ?? '').trim();
  if (normalized && hasHangul(normalized)) return normalized;
  return (await translateNewsTitleWithOpenAI(article)) || normalized || article.headline;
}

async function summarizeNewsBatchWithOpenAI(articles: FinnhubNewsRaw[]): Promise<NewsItem[]> {
  if (articles.length === 0) return [];

  const payload = articles.map((a) => ({
    id: String(a.id),
    headline: a.headline,
    summary: a.summary,
    source: a.source,
    related: a.related,
    url: a.url,
    datetime: a.datetime,
  }));

  const system =
    'You are a financial editor for Korean retail investors in US stocks. Translate each headline and source summary into natural Korean, then write a concise 3-line Korean summary. Output MUST be valid JSON only: an array of objects with keys id, titleKo, ticker, summaryLines (exactly 3 Korean strings). titleKo must be Korean. summaryLines: 3 short Korean lines each starting with core fact. ticker: primary US symbol from related or GLOBAL. No markdown, no commentary outside JSON.';

  const user = `Articles JSON:\n${JSON.stringify(payload, null, 0)}`;

  let rows: NewsBatchRow[] = [];
  try {
    const text = await openaiChatCompletion(system, user, 8192);
    rows = extractJsonArray<NewsBatchRow>(text);
  } catch (error) {
    if (__DEV__) {
      console.warn('[summarizeNewsBatchWithOpenAI]', articles.map((article) => article.id), error);
    }
    return Promise.all(articles.map((article) => buildFallbackNewsItemWithOpenAITitle(article)));
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return Promise.all(
    articles.map(async (a, i) => {
    const id = String(a.id);
    const row = byId.get(id) ?? rows[i];
    if (!row?.summaryLines?.length) {
      return buildFallbackNewsItemWithOpenAITitle(a);
    }
    const s = row.summaryLines;
    const summaryLines: [string, string, string] = [
      String(s[0] ?? ''),
      String(s[1] ?? ''),
      String(s[2] ?? ''),
    ];
    return {
      id,
      ticker: row.ticker || 'GLOBAL',
      titleKo: await ensureKoreanTitleWithOpenAI(a, row.titleKo),
      summaryLines,
      source: a.source,
      timeLabel: formatRelativeFromUnix(a.datetime),
      url: a.url,
      summarySource: 'openai',
      isFlash: isFlashNews(a),
    };
    }),
  );
}

export async function summarizeNewsWithOpenAI(articles: FinnhubNewsRaw[]): Promise<NewsItem[]> {
  if (articles.length === 0) return [];
  if (!hasOpenAI()) {
    return articles.map(newsItemFromFinnhubFallback);
  }

  const out: NewsItem[] = [];
  for (let i = 0; i < articles.length; i += NEWS_BATCH_SIZE) {
    const batch = articles.slice(i, i + NEWS_BATCH_SIZE);
    const summarized = await summarizeNewsBatchWithOpenAI(batch);
    out.push(...summarized);
  }
  return out;
}

type YtBatchRow = {
  id: string;
  topic: string;
  summaryLines: [string, string, string];
};

const YOUTUBE_SUMMARY_SYSTEM =
  'You analyze YouTube metadata for economy/finance videos. Return ONLY valid JSON array: objects with id, topic (short Korean label like \ud1b5\ud654\uc815\ucc45, \ubb3c\uac00, \uacbd\uae30, \ud658\uc728, \ud55c\uad6d\uacbd\uc81c, \uc9c0\ud45c, \uc815\ucc45, \uc6d0\uc790\uc7ac, \uc18d\ubcf4), summaryLines (exactly 3 Korean lines: what the viewer learns without watching).';

export async function summarizeYoutubeEconomyOpenAI(
  items: Array<{ id: string; title: string; channel: string; description: string }>,
): Promise<Map<string, { topic: string; summaryLines: [string, string, string] }>> {
  const out = new Map<string, { topic: string; summaryLines: [string, string, string] }>();
  if (items.length === 0) return out;
  if (!hasOpenAI()) {
    for (const it of items) {
      const [l1, l2, l3] = splitToThreeLines(it.description.slice(0, 800) || it.title);
      out.set(it.id, { topic: '\uacbd\uc81c', summaryLines: [l1, l2, l3] });
    }
    return out;
  }

  const user = `Videos JSON:\n${JSON.stringify(items)}`;
  let rows: YtBatchRow[] = [];
  try {
    const text = await openaiChatCompletion(YOUTUBE_SUMMARY_SYSTEM, user, 8192);
    rows = extractJsonArray<YtBatchRow>(text);
  } catch {
    rows = [];
  }
  for (const r of rows) {
    const s = r.summaryLines;
    const summaryLines: [string, string, string] = [
      String(s?.[0] ?? ''),
      String(s?.[1] ?? ''),
      String(s?.[2] ?? ''),
    ];
    out.set(r.id, { topic: r.topic || '\uacbd\uc81c', summaryLines });
  }
  for (const it of items) {
    if (!out.has(it.id)) {
      const [l1, l2, l3] = splitToThreeLines(it.description.slice(0, 800) || it.title);
      out.set(it.id, { topic: '\uacbd\uc81c', summaryLines: [l1, l2, l3] });
    }
  }
  return out;
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
): Promise<ConcallSummary> {
  const clipped = transcript.slice(0, 24_000);
  if (!hasOpenAI()) {
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets: [
        '\ud2b8\ub79c\uc2a4\ud06c\ub9bd\ud2b8 \uc694\uc57d\uc744 \uc704\ud574 OpenAI API \ud0a4\uac00 \ud544\uc694\ud569\ub2c8\ub2e4.',
        '\u2014',
      ],
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }

  const system =
    'You summarize earnings call transcripts for Korean investors. Return ONLY valid JSON: {"bullets":[two Korean strings],"guidance":"Korean one sentence or empty","risk":"Korean one sentence or empty"}.';

  const user = `Ticker ${ticker}, quarter ${quarterLabel}.\nTranscript:\n${clipped}`;

  let obj: ConcallJson;
  try {
    const text = await openaiChatCompletion(system, user, 4096);
    obj = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as ConcallJson;
  } catch {
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets: [
        '\uc694\uc57d JSON \ud30c\uc2f1\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.',
        '\ud2b8\ub79c\uc2a4\ud06c\ub9bd\ud2b8 \uc55e\ubd80\ubd84\ub9cc \ud655\uc778\ud574 \uc8fc\uc138\uc694.',
      ],
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }
  const bulletsRaw = Array.isArray(obj.bullets) ? obj.bullets.map((x) => String(x)) : [];
  const bullets =
    bulletsRaw.length >= 2
      ? [bulletsRaw[0], bulletsRaw[1]]
      : [
          bulletsRaw[0] ?? '\uc694\uc57d\uc744 \uc0dd\uc131\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.',
          bulletsRaw[1] ?? '\u2014',
        ];

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
