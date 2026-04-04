import { env, hasApiNinjas } from '@/services/env';

/** https://api-ninjas.com/api/earningscalltranscript */
export async function fetchEarningsCallTranscript(ticker: string, year: number): Promise<string | null> {
  if (!hasApiNinjas()) return null;
  const url = `https://api.api-ninjas.com/v1/earningscalltranscript?ticker=${encodeURIComponent(
    ticker,
  )}&year=${year}`;
  const res = await fetch(url, { headers: { 'X-Api-Key': env.apiNinjasKey } });
  if (!res.ok) return null;
  const data: unknown = await res.json();

  if (typeof data === 'string') return data;

  if (data && typeof data === 'object' && 'transcript' in data && typeof (data as { transcript: unknown }).transcript === 'string') {
    return (data as { transcript: string }).transcript;
  }

  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1] as Record<string, unknown>;
    if (typeof last?.transcript === 'string') return last.transcript as string;
    if (typeof last?.text === 'string') return last.text as string;
  }

  if (data && typeof data === 'object' && 'text' in data && typeof (data as { text: unknown }).text === 'string') {
    return (data as { text: string }).text;
  }

  return null;
}
