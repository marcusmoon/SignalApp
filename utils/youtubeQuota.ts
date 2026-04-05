/**
 * YouTube Data API 일일 쿼터는 태평양 자정(PT) 기준으로 갱신되는 것으로 알려져 있음.
 * API 응답에 정확한 리셋 시각이 없으므로, 다음 캘린더 일 경계(PT)까지의 시간을 근사한다.
 */
export const YOUTUBE_DATA_API_QUOTAS_CONSOLE_URL =
  'https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas';

/** 다음 태평양(PT) 자정(일 경계)까지 남은 ms 근사 — 일일 쿼터 갱신 시각으로 안내할 때 사용 */
export function msUntilNextPacificMidnight(now: Date = new Date()): number {
  const tz = 'America/Los_Angeles';
  const dateStr = (d: Date) =>
    d.toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });

  const start = now.getTime();
  const ds0 = dateStr(now);

  const crossed = (t: number) => dateStr(new Date(t)) !== ds0;

  let lo = start;
  let hi = start + 72 * 3600 * 1000;
  if (!crossed(hi)) {
    return 24 * 3600 * 1000;
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (crossed(mid)) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo - start;
}

export function quotaResetHoursMinutes(ms: number): { hours: number; minutes: number } {
  const safe = Math.max(0, ms);
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  return { hours, minutes };
}
