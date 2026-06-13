import { signalApi } from '@/integrations/signal-api/httpClient';

export type SignalRuntimeConfig = {
  service: string;
  version: string;
  features?: {
    ads?: {
      enabled?: boolean;
      scope?: string | null;
      updatedAt?: string | null;
    } | null;
  } | null;
};

export async function fetchSignalRuntimeConfig(): Promise<SignalRuntimeConfig> {
  return signalApi<SignalRuntimeConfig>('/v1/config', undefined, { timeoutMs: 3000, attempts: 1 });
}
