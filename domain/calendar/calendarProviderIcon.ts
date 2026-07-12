import type { SourceIconEntry } from '@/components/signal/SourceIconStack';

const PROVIDER_SOURCE_NAMES: Record<string, string> = {
  finnhub: 'Finnhub',
};

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

/** 캘린더 이벤트 데이터 제공자 → 출처 아이콘 (알 수 있는 provider만) */
export function calendarProviderSourceEntries(provider?: string | null): SourceIconEntry[] {
  const key = cleanText(provider).toLowerCase();
  const name = PROVIDER_SOURCE_NAMES[key];
  if (!name) return [];
  return [{ sourceName: name }];
}
