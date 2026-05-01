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
  /** 실적 발표 시간대 코드(bmo, amc 등) — UI에서 로캘 처리 */
  earningsHourCode?: string;
  title: string;
  type: 'earnings' | 'macro' | 'fed' | 'fomc';
  impact?: 'low' | 'medium' | 'high';
  actual?: number | null;
  estimate?: number | null;
  prev?: number | null;
  unit?: string;
  country?: string;
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
