import { hasSignalApi } from '@/services/env';
import { getEffectiveSignalApiBaseUrl } from '@/services/signalServerEndpoint';

export async function signalApi<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  if (!hasSignalApi()) throw new Error('SIGNAL_API_BASE_URL_MISSING');
  const base = getEffectiveSignalApiBaseUrl().replace(/\/+$/, '');
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) continue;
    q.set(key, String(value));
  }
  const suffix = q.toString() ? `${path}?${q.toString()}` : path;
  if (__DEV__) {
    console.log(`[Signal API] GET ${suffix}`);
  }
  const res = await fetch(`${base}${suffix}`);
  if (__DEV__) {
    console.log(`[Signal API] ${res.status} ${suffix}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Signal API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
