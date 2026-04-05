import { env, hasAnthropic } from '@/services/env';
import type { ConcallSummary, NewsItem } from '@/types/signal';
import type { FinnhubNewsRaw } from '@/services/finnhub';
import { isFlashNews } from '@/services/newsFlash';
import { formatRelativeFromUnix } from '@/utils/date';

const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';

type MsgContent = { type: 'text'; text: string };

async function messages(system: string, user: string, maxTokens = 8192): Promise<string> {
  if (!hasAnthropic()) throw new Error('ANTHROPIC_KEY_MISSING');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.anthropicKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: user } satisfies MsgContent] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const block = data.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

function extractJsonArray<T>(raw: string): T[] {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1].trim() : trimmed;
  const parsed = JSON.parse(jsonStr) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return parsed as T[];
}

function splitToThreeLines(text: string): [string, string, string] {
  const t = text.replace(/\s+/g, ' ').trim();
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const a = parts[0] ?? t.slice(0, 120);
  const b = parts[1] ?? '추가 맥락은 원문을 참고하세요.';
  const c = parts[2] ?? '—';
  return [a, b, c];
}

export function newsItemFromFinnhubFallback(n: FinnhubNewsRaw): NewsItem {
  const ticker = n.related.split(',')[0]?.trim() || 'GLOBAL';
  const base = (n.summary || '').trim() || n.headline;
  const [l1, l2, l3] = splitToThreeLines(base);
  return {
    id: String(n.id),
    ticker,
    titleKo: n.headline,
    summaryLines: [l1, l2, l3],
    source: n.source,
    timeLabel: formatRelativeFromUnix(n.datetime),
    url: n.url,
    summarySource: 'finnhub',
    isFlash: isFlashNews(n),
  };
}

type NewsBatchRow = {
  id: string;
  titleKo: string;
  ticker: string;
  summaryLines: [string, string, string];
};

export async function summarizeNewsWithClaude(articles: FinnhubNewsRaw[]): Promise<NewsItem[]> {
  if (articles.length === 0) return [];
  if (!hasAnthropic()) {
    return articles.map(newsItemFromFinnhubFallback);
  }

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
    'You are a financial editor for Korean retail investors in US stocks. Output MUST be valid JSON only: an array of objects with keys id, titleKo, ticker, summaryLines (exactly 3 Korean strings). titleKo must be Korean. summaryLines: 3 short Korean lines each starting with core fact. ticker: primary US symbol from related or GLOBAL. No markdown, no commentary outside JSON.';

  const user = `Articles JSON:\n${JSON.stringify(payload, null, 0)}`;

  let rows: NewsBatchRow[] = [];
  try {
    const text = await messages(system, user, 8192);
    rows = extractJsonArray<NewsBatchRow>(text);
  } catch {
    return articles.map(newsItemFromFinnhubFallback);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return articles.map((a, i) => {
    const id = String(a.id);
    const row = byId.get(id) ?? rows[i];
    if (!row?.summaryLines?.length) {
      return newsItemFromFinnhubFallback(a);
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
      titleKo: row.titleKo,
      summaryLines,
      source: a.source,
      timeLabel: formatRelativeFromUnix(a.datetime),
      url: a.url,
      summarySource: 'claude',
      isFlash: isFlashNews(a),
    };
  });
}

type YtBatchRow = {
  id: string;
  topic: string;
  summaryLines: [string, string, string];
};

export async function summarizeYoutubeEconomy(
  items: Array<{ id: string; title: string; channel: string; description: string }>,
): Promise<Map<string, { topic: string; summaryLines: [string, string, string] }>> {
  const out = new Map<string, { topic: string; summaryLines: [string, string, string] }>();
  if (items.length === 0) return out;
  if (!hasAnthropic()) {
    for (const it of items) {
      const [l1, l2, l3] = splitToThreeLines(it.description.slice(0, 800) || it.title);
      out.set(it.id, { topic: '경제', summaryLines: [l1, l2, l3] });
    }
    return out;
  }

  const system =
    'You analyze YouTube metadata for economy/finance videos. Return ONLY valid JSON array: objects with id, topic (short Korean label like 통화정책, 물가, 경기, 환율, 한국경제, 지표, 정책, 원자재, 속보), summaryLines (exactly 3 Korean lines: what the viewer learns without watching).';

  const user = `Videos JSON:\n${JSON.stringify(items)}`;
  let rows: YtBatchRow[] = [];
  try {
    const text = await messages(system, user, 8192);
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
    out.set(r.id, { topic: r.topic || '경제', summaryLines });
  }
  for (const it of items) {
    if (!out.has(it.id)) {
      const [l1, l2, l3] = splitToThreeLines(it.description.slice(0, 800) || it.title);
      out.set(it.id, { topic: '경제', summaryLines: [l1, l2, l3] });
    }
  }
  return out;
}

type ConcallJson = {
  bullets: [string, string];
  guidance: string;
  risk: string;
};

export async function summarizeConcallTranscript(
  ticker: string,
  quarterLabel: string,
  transcript: string,
): Promise<ConcallSummary> {
  const clipped = transcript.slice(0, 24_000);
  if (!hasAnthropic()) {
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets: ['트랜스크립트 요약을 위해 Anthropic API 키가 필요합니다.', '—'],
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
    const text = await messages(system, user, 4096);
    obj = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as ConcallJson;
  } catch {
    return {
      id: `${ticker}-${quarterLabel}`,
      ticker,
      quarter: quarterLabel,
      bullets: ['요약 JSON 파싱에 실패했습니다.', '트랜스크립트 앞부분만 확인해 주세요.'],
      guidance: undefined,
      risk: undefined,
      source: 'fallback',
    };
  }
  const bulletsRaw = Array.isArray(obj.bullets) ? obj.bullets.map((x) => String(x)) : [];
  const bullets =
    bulletsRaw.length >= 2
      ? [bulletsRaw[0], bulletsRaw[1]]
      : [bulletsRaw[0] ?? '요약을 생성하지 못했습니다.', bulletsRaw[1] ?? '—'];

  return {
    id: `${ticker}-${quarterLabel}`,
    ticker,
    quarter: quarterLabel,
    bullets,
    guidance: obj.guidance || undefined,
    risk: obj.risk || undefined,
    source: 'claude',
  };
}
