import { signalApiRequest } from '@/integrations/signal-api/client';

export type SignalLegalTerm = {
  id: string;
  type: 'service' | 'privacy' | string;
  locale: string;
  version: string;
  title: string;
  body: string;
  required: boolean;
  active: boolean;
  updatedAt?: string;
};

export async function fetchSignalLegalTerms(locale: string): Promise<SignalLegalTerm[]> {
  const params = new URLSearchParams({ locale });
  const json = await signalApiRequest<{ data: SignalLegalTerm[] }>(`/v1/legal/terms?${params.toString()}`);
  return Array.isArray(json.data) ? json.data : [];
}
