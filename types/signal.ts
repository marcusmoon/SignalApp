export type NewsItem = {
  id: string;
  ticker: string;
  titleKo: string;
  summaryLines: [string, string, string];
  source: string;
  timeLabel: string;
  url: string;
  summarySource?: 'claude' | 'finnhub';
  /** 속보·긴급 보도 강조 표시 */
  isFlash?: boolean;
};

export type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: 'earnings' | 'macro' | 'fed';
};

export type ConcallSummary = {
  id: string;
  ticker: string;
  quarter: string;
  bullets: string[];
  guidance?: string;
  risk?: string;
  source: 'claude' | 'fallback';
};

export type YoutubeItem = {
  id: string;
  topic: string;
  title: string;
  channel: string;
  viewLabel: string;
  publishedLabel: string;
  durationLabel: string;
  summaryLines: [string, string, string];
  thumbnailUrl?: string | null;
  videoId?: string;
};
