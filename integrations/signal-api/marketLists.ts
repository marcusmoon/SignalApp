import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiMarketList } from '@/integrations/signal-api/types';

export async function fetchSignalMarketList(key: string): Promise<SignalApiMarketList> {
  const json = await signalApi<{ data: SignalApiMarketList }>(`/v1/market-lists/${encodeURIComponent(key)}`);
  return json.data;
}
