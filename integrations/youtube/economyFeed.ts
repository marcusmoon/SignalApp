import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from './constants';
import { ECONOMY_SEARCH_BOOST } from '@/domain/youtube';
import type { ChannelsList, SearchList, VideoList } from '@/integrations/youtube/apiTypes';
import { isYoutubeDataApiConfigured, youtubeDataApiUrl } from '@/integrations/youtube/client';
import {
  parseYoutubeError,
  throwYoutubeBodyError,
  throwYoutubeHttpError,
} from '@/integrations/youtube/errors';
import type { ChannelHandleMeta } from '@/integrations/youtube/types';
import { messages, type AppLocale } from '@/locales/messages';
import type { YoutubeItem } from '@/types/signal';
import { formatRelativeFromIso } from '@/utils/date';
import { formatIso8601Duration, formatViewCount } from '@/utils/format';

const SEARCH_QUERY_FALLBACKS = [
  'US economy Federal Reserve inflation news',
  'economy news today',
  `${ECONOMY_SEARCH_BOOST} economy`.replace(/\s+/g, ' ').trim(),
];

async function fetchChannelIdByHandle(handle: string): Promise<string | null> {
  const res = await fetch(youtubeDataApiUrl('channels', { part: 'id', forHandle: handle }));
  const raw = await res.json();
  if (!res.ok) return null;
  const err = parseYoutubeError(raw);
  if (err) return null;
  const items = (raw as ChannelsList).items;
  return items?.[0]?.id ?? null;
}

export async function fetchChannelDisplayNames(handles: readonly string[]): Promise<ChannelHandleMeta[]> {
  if (!isYoutubeDataApiConfigured()) {
    return handles.map((h) => ({ handle: h, title: `@${h}` }));
  }
  const out: ChannelHandleMeta[] = [];
  for (const handle of handles) {
    const res = await fetch(youtubeDataApiUrl('channels', { part: 'snippet', forHandle: handle }));
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
    youtubeDataApiUrl('search', {
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
      youtubeDataApiUrl('search', {
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
  options?: { channelHandles?: readonly string[]; locale?: AppLocale },
): Promise<YoutubeItem[]> {
  if (!isYoutubeDataApiConfigured()) throw new Error('YOUTUBE_KEY_MISSING');

  const locale = options?.locale ?? 'ko';
  const handles =
    options?.channelHandles && options.channelHandles.length > 0
      ? options.channelHandles
      : [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];

  const ids = await collectVideoIds(order, handles);
  if (ids.length === 0) return [];

  const v = await fetch(
    youtubeDataApiUrl('videos', {
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

  const topic = messages[locale].youtubeTopicEconomy;

  return meta.map((it) => {
    const vc = it.statistics?.viewCount ? parseInt(it.statistics.viewCount, 10) : 0;
    return {
      id: it.id,
      topic,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      viewLabel: formatViewCount(vc),
      publishedLabel: formatRelativeFromIso(it.snippet.publishedAt, locale),
      durationLabel: formatIso8601Duration(it.contentDetails.duration),
      thumbnailUrl: `https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`,
      videoId: it.id,
    } satisfies YoutubeItem;
  });
}
