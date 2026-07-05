/** 알림센터 UI row — 서버 inbox API 응답을 매핑한 형태 */
export type StoredNotification = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  high: boolean;
  type?: string;
  sourceType?: string;
  sourceId?: string;
  deepLink?: string;
  payload?: Record<string, unknown>;
};
