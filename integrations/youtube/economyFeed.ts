import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from './constants';
import { fetchSignalYoutube, signalYoutubeToYoutubeItem } from '@/integrations/signal-api/youtube';
import type { ChannelHandleMeta } from '@/integrations/youtube/types';
import type { AppLocale } from '@/locales/messages';
import type { YoutubeItem } from '@/types/signal';

export async function fetchChannelDisplayNames(handles: readonly string[]): Promise<ChannelHandleMeta[]> {
  return handles.map((handle) => ({ handle, title: `@${handle}` }));
}

export async function fetchEconomyYoutube(
  order: 'viewCount' | 'date',
  options?: { channelHandles?: readonly string[]; locale?: AppLocale },
): Promise<YoutubeItem[]> {
  void order;
  void options?.channelHandles;
  const locale = options?.locale ?? 'ko';
  const rows = await fetchSignalYoutube({ pageSize: Math.max(DEFAULT_YOUTUBE_CHANNEL_HANDLES.length, 100) });
  return rows.map((row) => signalYoutubeToYoutubeItem(row, locale));
}
