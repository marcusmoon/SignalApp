import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from './constants';

export type { ChannelHandleMeta } from '@/integrations/youtube/types';

/** Default curation (fallback). 실제 목록은 설정 / `loadCurationHandles()` */
export const YOUTUBE_CHANNEL_HANDLES = DEFAULT_YOUTUBE_CHANNEL_HANDLES;

export { YOUTUBE_ERROR_QUOTA } from '@/integrations/youtube/errors';
export { fetchChannelDisplayNames, fetchEconomyYoutube } from '@/integrations/youtube/economyFeed';
