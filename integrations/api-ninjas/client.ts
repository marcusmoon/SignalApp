/**
 * API Ninjas calls are server-side only. The app no longer reads or sends provider keys.
 */
import type { NinjasTranscriptResult } from './types';

/**
 * @param yearQuarter — Finnhub 실적 행의 year·quarter. 생략 시 최신 분기.
 */
export async function fetchEarningsCallTranscript(
  ticker: string,
  yearQuarter?: { year: number; quarter: number },
): Promise<NinjasTranscriptResult> {
  void ticker;
  void yearQuarter;
  return { transcript: null, httpStatus: 0 };
}
