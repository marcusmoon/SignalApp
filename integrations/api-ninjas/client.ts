/**
 * API Ninjas — **이 파일만** `env.apiNinjasKey`를 읽어 아웃바운드 요청에 붙인다.
 * https://api-ninjas.com/api/earningscalltranscript — 실제 경로 `/v1/earningstranscript`.
 */
import { env, hasApiNinjas } from '@/services/env';

import type { NinjasTranscriptResult } from './types';

/**
 * 공식 문서: https://api-ninjas.com/api/earningscalltranscript
 * year를 지정하면 quarter도 필수. 둘 다 생략 시 해당 티커 최신 트랜스크립트.
 * Premium 전용일 수 있음 — 무료 키만으로는 403 가능.
 */
const EARNING_TRANSCRIPT_URL = 'https://api.api-ninjas.com/v1/earningstranscript';

function parseTranscriptBody(data: unknown): string | null {
  if (typeof data === 'string') return data;

  if (
    data &&
    typeof data === 'object' &&
    'transcript' in data &&
    typeof (data as { transcript: unknown }).transcript === 'string'
  ) {
    return (data as { transcript: string }).transcript;
  }

  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1] as Record<string, unknown>;
    if (typeof last?.transcript === 'string') return last.transcript as string;
    if (typeof last?.text === 'string') return last.text as string;
  }

  if (
    data &&
    typeof data === 'object' &&
    'text' in data &&
    typeof (data as { text: unknown }).text === 'string'
  ) {
    return (data as { text: string }).text;
  }

  return null;
}

/**
 * @param yearQuarter — Finnhub 실적 행의 year·quarter. 생략 시 최신 분기.
 */
export async function fetchEarningsCallTranscript(
  ticker: string,
  yearQuarter?: { year: number; quarter: number },
): Promise<NinjasTranscriptResult> {
  if (!hasApiNinjas()) {
    return { transcript: null, httpStatus: 0 };
  }
  const params = new URLSearchParams({ ticker: ticker.trim().toUpperCase() });
  if (yearQuarter) {
    params.set('year', String(yearQuarter.year));
    params.set('quarter', String(yearQuarter.quarter));
  }
  const url = `${EARNING_TRANSCRIPT_URL}?${params.toString()}`;
  const res = await fetch(url, { headers: { 'X-Api-Key': env.apiNinjasKey } });
  if (!res.ok) {
    return { transcript: null, httpStatus: res.status };
  }
  const data: unknown = await res.json();
  return { transcript: parseTranscriptBody(data), httpStatus: res.status };
}
