import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';
import { ECONOMY_SEARCH_BOOST } from '@/lib/youtubeEconomy';
import { env, hasYoutube } from '@/services/env';
import { summarizeYoutubeEconomy } from '@/services/anthropic';
import type { YoutubeItem } from '@/types/signal';
import { formatIso8601Duration, formatViewCount } from '@/utils/format';
import { formatRelativeFromIso } from '@/utils/date';

/** 기본 큐레이션(폴백). 실제 목록은 설정·loadCurationHandles() */
export const YOUTUBE_CHANNEL_HANDLES = DEFAULT_YOUTUBE_CHANNEL_HANDLES;

type SearchList = {
  error?: { code: number; message: string };
  items?: Array<{
    id: { videoId?: string; kind?: string };
    snippet: { title: string; channelTitle: string; description: string; publishedAt: string };
  }>;
};

type VideoList = {
  error?: { code: number; message: string };
  items?: Array<{
    id: string;
    contentDetails: { duration: string };
    statistics?: { viewCount: string };
    snippet: { title: string; channelTitle: string; description: string; publishedAt: string };
  }>;
};

type ChannelsList = {
  error?: { code: number; message: string };
  items?: Array<{ id: string }>;
};

export type ChannelHandleMeta = {
  handle: string;
  /** YouTube 채널 표시 이름 (snippet.title) */
  title: string;
};

function apiUrl(path: string, params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, key: env.youtubeKey });
  return `https://www.googleapis.com/youtube/v3/${path}?${q.toString()}`;
}

/** 키워드 검색 폴백 (채널 ID를 하나도 못 찾았을 때만) */
const SEARCH_QUERY_FALLBACKS = [
  'US economy Federal Reserve inflation news',
  'economy news today',
  `${ECONOMY_SEARCH_BOOST} economy`.replace(/\s+/g, ' ').trim(),
];

function parseYoutubeError(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: { message?: string; code?: number } }).error;
    if (e?.message) return e.message;
  }
  return null;
}

/** UI에서 `t('youtubeErrorQuota')` 로 매핑 */
export const YOUTUBE_ERROR_QUOTA = 'YOUTUBE_QUOTA';

function isYoutubeQuotaExceeded(status: number, body: unknown): boolean {
  const err =
    body && typeof body === 'object'
      ? (body as { error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> } }).error
      : undefined;
  if (!err) return false;
  if (status !== 403 && err.code !== 403) return false;
  const r0 = err.errors?.[0]?.reason;
  if (r0 === 'quotaExceeded' || r0 === 'dailyLimitExceeded' || r0 === 'rateLimitExceeded') return true;
  return (err.message ?? '').toLowerCase().includes('quota');
}

function throwYoutubeHttpError(res: Response, raw: unknown, label: string): never {
  if (isYoutubeQuotaExceeded(res.status, raw)) {
    throw new Error(YOUTUBE_ERROR_QUOTA);
  }
  const msg = parseYoutubeError(raw) ?? JSON.stringify(raw).slice(0, 200);
  throw new Error(`YouTube ${label} ${res.status}: ${msg}`);
}

function throwYoutubeBodyError(res: Response, raw: unknown, label: string): never {
  const errMsg = parseYoutubeError(raw);
  if (errMsg) {
    if (isYoutubeQuotaExceeded(res.status, raw)) throw new Error(YOUTUBE_ERROR_QUOTA);
    throw new Error(`YouTube: ${errMsg}`);
  }
  throw new Error(`YouTube ${label}: unknown error`);
}

async function fetchChannelIdByHandle(handle: string): Promise<string | null> {
  const res = await fetch(apiUrl('channels', { part: 'id', forHandle: handle }));
  const raw = await res.json();
  if (!res.ok) return null;
  const err = parseYoutubeError(raw);
  if (err) return null;
  const items = (raw as ChannelsList).items;
  return items?.[0]?.id ?? null;
}

/** 핸들별 공식 채널 표시 이름 (하단 큐레이션 표시용) */
export async function fetchChannelDisplayNames(handles: readonly string[]): Promise<ChannelHandleMeta[]> {
  if (!hasYoutube()) {
    return handles.map((h) => ({ handle: h, title: `@${h}` }));
  }
  const out: ChannelHandleMeta[] = [];
  for (const handle of handles) {
    const res = await fetch(apiUrl('channels', { part: 'snippet', forHandle: handle }));
    const raw = await res.json();
    if (!res.ok) {
      out.push({ handle, title: `@${handle}` });
      continue;
    }
    if (parseYoutubeError(raw)) {
      out.push({ handle, title: `@${handle}` });
      continue;
    }
    const title = (raw as { items?: Array<{ snippet?: { title?: string } }> }).items?.[0]?.snippet?.title;
    out.push({ handle, title: title?.trim() || `@${handle}` });
  }
  return out;
}

async function searchVideoIdsOnChannel(channelId: string, order: 'viewCount' | 'date'): Promise<string[]> {
  const search = await fetch(
    apiUrl('search', {
      part: 'snippet',
      channelId,
      type: 'video',
      maxResults: '6',
      order,
    }),
  );
  const raw = await search.json();
  if (!search.ok) {
    throwYoutubeHttpError(search, raw, 'search');
  }
  const errMsg = parseYoutubeError(raw);
  if (errMsg) throwYoutubeBodyError(search, raw, 'search');

  const sjson = raw as SearchList;
  return (sjson.items ?? [])
    .map((i) => i.id?.videoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

async function searchVideoIdsByKeyword(order: 'viewCount' | 'date'): Promise<string[]> {
  for (const q of SEARCH_QUERY_FALLBACKS) {
    const search = await fetch(
      apiUrl('search', {
        part: 'snippet',
        type: 'video',
        maxResults: '10',
        order,
        q,
      }),
    );
    const raw = await search.json();
    if (!search.ok) {
      throwYoutubeHttpError(search, raw, 'search');
    }
    const errMsg = parseYoutubeError(raw);
    if (errMsg) throwYoutubeBodyError(search, raw, 'search');

    const sjson = raw as SearchList;
    const ids = (sjson.items ?? [])
      .map((i) => i.id?.videoId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (ids.length > 0) return ids;
  }
  return [];
}

async function collectVideoIds(order: 'viewCount' | 'date', handles: readonly string[]): Promise<string[]> {
  const channelIds: string[] = [];
  for (const handle of handles) {
    const cid = await fetchChannelIdByHandle(handle);
    if (cid) channelIds.push(cid);
  }

  const idSet = new Set<string>();
  if (channelIds.length > 0) {
    for (const cid of channelIds) {
      const ids = await searchVideoIdsOnChannel(cid, order);
      for (const id of ids) idSet.add(id);
    }
  }

  if (idSet.size === 0) {
    const fallback = await searchVideoIdsByKeyword(order);
    for (const id of fallback) idSet.add(id);
  }

  return [...idSet];
}

function sortVideos(
  items: NonNullable<VideoList['items']>,
  order: 'viewCount' | 'date',
): NonNullable<VideoList['items']> {
  const copy = [...items];
  if (order === 'viewCount') {
    copy.sort(
      (a, b) =>
        parseInt(b.statistics?.viewCount ?? '0', 10) - parseInt(a.statistics?.viewCount ?? '0', 10),
    );
  } else {
    copy.sort(
      (a, b) =>
        new Date(b.snippet.publishedAt).getTime() - new Date(a.snippet.publishedAt).getTime(),
    );
  }
  return copy;
}

export async function fetchEconomyYoutube(
  order: 'viewCount' | 'date',
  options?: { channelHandles?: readonly string[] },
): Promise<YoutubeItem[]> {
  if (!hasYoutube()) throw new Error('YOUTUBE_KEY_MISSING');

  const handles =
    options?.channelHandles && options.channelHandles.length > 0
      ? options.channelHandles
      : [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];

  const ids = await collectVideoIds(order, handles);
  if (ids.length === 0) return [];

  const v = await fetch(
    apiUrl('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(0, 50).join(','),
    }),
  );
  const rawV = await v.json();
  if (!v.ok) {
    throwYoutubeHttpError(v, rawV, 'videos');
  }
  const errV = parseYoutubeError(rawV);
  if (errV) throwYoutubeBodyError(v, rawV, 'videos');

  const vjson = rawV as VideoList;
  let meta = vjson.items ?? [];
  meta = sortVideos(meta, order);

  const forAi = meta.map((it) => ({
    id: it.id,
    title: it.snippet.title,
    channel: it.snippet.channelTitle,
    description: it.snippet.description ?? '',
  }));

  const sumMap = await summarizeYoutubeEconomy(forAi);

  return meta.map((it) => {
    const vc = it.statistics?.viewCount ? parseInt(it.statistics.viewCount, 10) : 0;
    const s = sumMap.get(it.id);
    return {
      id: it.id,
      topic: s?.topic ?? '경제',
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      viewLabel: formatViewCount(vc),
      publishedLabel: formatRelativeFromIso(it.snippet.publishedAt),
      durationLabel: formatIso8601Duration(it.contentDetails.duration),
      summaryLines: s?.summaryLines ?? ['요약을 불러오지 못했습니다.', '—', '—'],
      thumbnailUrl: `https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`,
      videoId: it.id,
    } satisfies YoutubeItem;
  });
}
