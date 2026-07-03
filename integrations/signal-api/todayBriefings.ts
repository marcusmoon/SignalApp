import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';

export async function fetchSignalTodayBriefing(
  params: {
    date?: string;
    locale?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<SignalApiTodayBriefing | null> {
  const json = await signalApi<{ data: SignalApiTodayBriefing | null }>(
    '/v1/today-briefing',
    {
      date: params.date,
      locale: params.locale ?? 'ko',
      from: params.from,
      to: params.to,
    },
    { timeoutMs: 4000, attempts: 1 },
  );
  return json.data ?? null;
}
