import { hasSignalApi } from '@/services/env';
import { getEffectiveSignalApiBaseUrl } from '@/services/signalServerEndpoint';
import type { MessageId } from '@/locales/messages';

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 2;

export type SignalApiErrorKind = 'config' | 'timeout' | 'network' | 'server' | 'http' | 'parse';

export class SignalApiError extends Error {
  kind: SignalApiErrorKind;
  status?: number;

  constructor(kind: SignalApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'SignalApiError';
    this.kind = kind;
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRetriable(error: unknown): boolean {
  if (error instanceof SignalApiError) {
    return error.kind === 'timeout' || error.kind === 'network' || (error.kind === 'server' && (error.status || 0) >= 500);
  }
  return isAbortError(error);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    if (isAbortError(error)) throw new SignalApiError('timeout', 'SIGNAL_API_TIMEOUT');
    throw new SignalApiError('network', 'SIGNAL_API_NETWORK');
  } finally {
    clearTimeout(timeout);
  }
}

function messageKeyForSignalApiError(error: unknown, fallbackId: MessageId): MessageId {
  if (!(error instanceof SignalApiError)) return fallbackId;
  if (error.kind === 'config') return 'signalApiErrorConfig';
  if (error.kind === 'timeout') return 'signalApiErrorTimeout';
  if (error.kind === 'network') return 'signalApiErrorNetwork';
  if (error.kind === 'server') return 'signalApiErrorServer';
  if (error.kind === 'parse') return 'signalApiErrorParse';
  return 'signalApiErrorHttp';
}

export function formatSignalApiError(
  error: unknown,
  t: (id: MessageId) => string,
  fallbackId: MessageId,
): string {
  return t(messageKeyForSignalApiError(error, fallbackId));
}

export async function signalApi<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  if (!hasSignalApi()) throw new SignalApiError('config', 'SIGNAL_API_BASE_URL_MISSING');
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
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetchWithTimeout(`${base}${suffix}`, DEFAULT_TIMEOUT_MS);
      if (__DEV__) {
        console.log(`[Signal API] ${res.status} ${suffix}`);
      }
      if (!res.ok) {
        if (__DEV__) {
          const body = await res.text().catch(() => '');
          console.log(`[Signal API] body ${body.slice(0, 200)}`);
        }
        const kind: SignalApiErrorKind = res.status >= 500 ? 'server' : 'http';
        throw new SignalApiError(kind, `SIGNAL_API_${res.status}`, res.status);
      }
      try {
        return (await res.json()) as T;
      } catch {
        throw new SignalApiError('parse', 'SIGNAL_API_PARSE');
      }
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS || !isRetriable(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new SignalApiError('network', 'SIGNAL_API_NETWORK');
}
