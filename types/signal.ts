export type NewsItem = {
  id: string;
  ticker: string;
  titleKo: string;
  source: string;
  timeLabel: string;
  url: string;
  summarySource?: 'claude' | 'openai' | 'finnhub';
  /** 속보·긴급 보도 강조 표시 */
  isFlash?: boolean;
};

export type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: 'earnings' | 'macro' | 'fed' | 'fomc';
};

export type ConcallSummary = {
  id: string;
  ticker: string;
  quarter: string;
  bullets: string[];
  guidance?: string;
  risk?: string;
  source: 'claude' | 'openai' | 'fallback';
  /** 트랜스크립트가 확보된 경우 화면용 발췌(전문은 앱에 보관하지 않음) */
  transcriptSnippet?: string;
};

export type YoutubeItem = {
  id: string;
  topic: string;
  title: string;
  channel: string;
  viewLabel: string;
  publishedLabel: string;
  durationLabel: string;
  thumbnailUrl?: string | null;
  videoId?: string;
};
