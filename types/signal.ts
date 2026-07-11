export type NewsItem = {
  id: string;
  ticker: string;
  titleKo: string;
  originalTitle?: string;
  originalSummary?: string;
  /** 제목 토글용 대체 언어 제목 */
  alternateTitle?: string;
  /** 기사 매체·출처명 (표시용) */
  source: string;
  /** ISO — 타임라인·상세 시각 표시 */
  publishedAt?: string | null;
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
  eventAt?: string | null;
  timezone?: string | null;
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
  publishedLabel: string;
  durationLabel: string;
  thumbnailUrl?: string | null;
  videoId?: string;
  url?: string;
};
