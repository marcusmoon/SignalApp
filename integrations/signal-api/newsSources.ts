import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiNewsSource } from '@/integrations/signal-api/types';

export async function fetchSignalNewsSources(params?: { category?: string }): Promise<SignalApiNewsSource[]> {
  const json = await signalApi<{ data: SignalApiNewsSource[] }>('/v1/news-sources', params);
  return Array.isArray(json.data) ? json.data : [];
}

