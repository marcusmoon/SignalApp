import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiYoutubeVideo } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { messages } from '@/locales/messages';
import type { YoutubeItem } from '@/types/signal';
import { formatRelativeFromIso } from '@/utils/date';
import { formatIso8601Duration, formatViewCount } from '@/utils/format';

export async function fetchSignalYoutube(params?: {
  q?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
}): Promise<SignalApiYoutubeVideo[]> {
  const json = await signalApi<{ data: SignalApiYoutubeVideo[] }>('/v1/youtube', params);
  return json.data;
}

export function signalYoutubeToYoutubeItem(item: SignalApiYoutubeVideo, locale: AppLocale): YoutubeItem {
  return {
    id: item.id,
    topic: messages[locale].youtubeTopicEconomy,
    title: item.title,
    channel: item.channel,
    viewLabel: formatViewCount(item.viewCount || 0),
    publishedLabel: item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—',
    durationLabel: item.duration ? formatIso8601Duration(item.duration) : '—',
    thumbnailUrl: item.thumbnailUrl,
    videoId: item.videoId,
  };
}
