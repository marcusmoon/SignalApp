export type NewsItem = {
  id: string;
  ticker: string;
  titleKo: string;
  /** 기사 매체·출처명 (표시용) */
  source: string;
  timeLabel: string;
  url: string;
  /** 속보·긴급 보도 강조 표시 */
  isFlash?: boolean;
  /** 서버 `hashtags` — UI는 `maxHashtagsToShow`로 일부만 표시 */
  hashtags?: { label: string; order: number; source?: string }[];
};

export type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: 'macro' | 'fed' | 'fomc' | 'earnings' | 'holiday';
  impact?: 'low' | 'medium' | 'high';
  actual?: number | null;
  estimate?: number | null;
  prev?: number | null;
  unit?: string;
  country?: string;
  /** 실적 이벤트 전용 */
  symbol?: string | null;
  fiscalYear?: number | null;
  fiscalQuarter?: number | null;
  earningsHour?: string | null;
};

export type YoutubeItem = {
  id: string;
  topic: string;
  title: string;
  channel: string;
  viewLabel: string;
  likeLabel?: string;
  commentLabel?: string;
  publishedLabel: string;
  durationLabel: string;
  description?: string;
  thumbnailUrl?: string | null;
  captionAvailable?: boolean;
  definition?: string;
  categoryId?: string | null;
  topicCategories?: string[];
  channelThumbnailUrl?: string | null;
  channelDescription?: string;
  channelSubscriberLabel?: string;
  channelVideoCountLabel?: string;
  channelViewLabel?: string;
  channelCustomUrl?: string | null;
  channelCountry?: string | null;
  videoId?: string;
  url?: string;
};
