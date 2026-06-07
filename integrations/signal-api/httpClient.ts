import { hasSignalApi } from '@/services/env';
import { getEffectiveSignalApiBaseUrl } from '@/services/signalServerEndpoint';
import type { MessageId } from '@/locales/messages';

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 2;
const DEV_SLOW_API_LOG_MS = 1500;
/** 액세스 만료 이전에 미리 갱신(밀리초). 짧은 액세스 TTL 서버에서도 401 플래시 완화 */
const PROACTIVE_REFRESH_LEEWAY_MS = 120_000;

/** 공개·본문 인증 라우트: 401 시 access refresh 는 루프이거나 무의미. Bearer `social/link` 는 제외하여 만료된 액세스 토큰을 갱신할 수 있게 함 */
function authPathSkipsRefresh(pathWithOptionalQuery: string): boolean {
  const pathOnly = pathWithOptionalQuery.split('?')[0] || '';
  return (
    pathOnly === '/v1/auth/login' ||
    pathOnly === '/v1/auth/register' ||
    pathOnly === '/v1/auth/refresh' ||
    pathOnly === '/v1/auth/social/login' ||
    pathOnly === '/v1/auth/social/providers'
  );
}

/** RS256 JWT `exp` 추출(검증 없음). 레거시 비‑JWT 세션은 null */
function accessTokenExpiryMsFromJwt(accessToken: string): number | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const parsed = JSON.parse(atob(b64 + pad)) as { exp?: number };
    if (typeof parsed.exp !== 'number') return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

function shouldRefreshAccessSoon(accessToken: string, nowMs: number = Date.now()): boolean {
  const expMs = accessTokenExpiryMsFromJwt(accessToken);
  if (expMs == null) return false;
  return expMs - PROACTIVE_REFRESH_LEEWAY_MS <= nowMs;
}

/** 비‑JWT: 저장된 ISO 만료 시각 기준 선제 갱신 */
function shouldRefreshAccessSoonFromIso(iso: string, nowMs: number = Date.now()): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t - PROACTIVE_REFRESH_LEEWAY_MS <= nowMs;
}

let refreshSingleFlight: Promise<string | null> | null = null;

async function refreshAccessTokenImpl(): Promise<string | null> {
  try {
    const { loadAppAuthSession, saveAppAuthSession } = await import('@/services/appAuthSession');
    const { getOrCreateAppDeviceId } = await import('@/services/appDeviceId');
    const stored = await loadAppAuthSession();
    if (!stored?.user?.id) return null;
    const refreshToken = stored.refreshToken;
    if (!refreshToken) return null;
    const deviceId = stored.deviceId || (await getOrCreateAppDeviceId());
    const base = getEffectiveSignalApiBaseUrl().replace(/\/+$/, '');
    const res = await fetchWithTimeout(`${base}/v1/auth/refresh`, DEFAULT_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ refreshToken, deviceId }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        user?: import('@/integrations/signal-api/auth').SignalAppUser;
        accessToken?: string;
        refreshToken?: string;
        accessExpiresAt?: string;
        refreshExpiresAt?: string;
        deviceId?: string;
        token?: string;
        expiresAt?: string;
      };
    };
    const data = json?.data;
    const accessToken = data?.accessToken || data?.token;
    if (!accessToken) return null;
    await saveAppAuthSession({
      user: data.user || stored.user,
      accessToken,
      refreshToken: data.refreshToken ?? stored.refreshToken,
      accessExpiresAt: data.accessExpiresAt || data.expiresAt || '',
      refreshExpiresAt: data.refreshExpiresAt || data.accessExpiresAt || data.expiresAt || '',
      deviceId: data.deviceId || deviceId,
    });
    return accessToken;
  } catch {
    return null;
  }
}

/** 저장된 세션 단일 진행 리프레시(동시 401 폭격 시 레이스 방지) */
async function tryRefreshAccessToken(): Promise<string | null> {
  if (!refreshSingleFlight) {
    refreshSingleFlight = refreshAccessTokenImpl().finally(() => {
      refreshSingleFlight = null;
    });
  }
  return refreshSingleFlight;
}

/** JWT 만료가 임박했거나 지났을 때 저장소 기준으로 한 번 리프레시(요청당 부담·선제 완화) */
async function maybeProactiveRefreshBearer(bearer: string | null): Promise<string | null> {
  if (!bearer || !shouldRefreshAccessSoon(bearer)) return null;
  return tryRefreshAccessToken();
}

/** 앱 기동·포그라운드: 저장된 JWT/만료 필드 보고 필요 시 리프레시(첫 화면 401 줄임) */
export async function ensureStoredSessionFresh(): Promise<void> {
  if (!hasSignalApi()) return;
  try {
    const { loadAppAuthSession, getSessionAccessToken } = await import('@/services/appAuthSession');
    const stored = await loadAppAuthSession();
    const access = getSessionAccessToken(stored);
    if (!access || !stored?.refreshToken) return;
    const jwtExpSoon = accessTokenExpiryMsFromJwt(access) !== null ? shouldRefreshAccessSoon(access) : false;
    const isoSoon =
      accessTokenExpiryMsFromJwt(access) === null &&
      shouldRefreshAccessSoonFromIso(String(stored.accessExpiresAt || ''));
    if (jwtExpSoon || isoSoon) await tryRefreshAccessToken();
  } catch {
    /* ignore */
  }
}

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

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { accept: 'application/json', ...(init?.headers || {}) },
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

export async function signalApiRequest<T>(
  path: string,
  options: {
    params?: Record<string, string | number | undefined>;
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    token?: string | null;
    timeoutMs?: number;
    attempts?: number;
  } = {},
): Promise<T> {
  if (!hasSignalApi()) throw new SignalApiError('config', 'SIGNAL_API_BASE_URL_MISSING');
  const base = getEffectiveSignalApiBaseUrl().replace(/\/+$/, '');
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value == null) continue;
    q.set(key, String(value));
  }
  const suffix = q.toString() ? `${path}?${q.toString()}` : path;
  const method = options.method || 'GET';
  const headers: Record<string, string> = {};
  if (options.body != null) headers['content-type'] = 'application/json';
  let bearer = options.token || null;
  if (bearer) {
    const replaced = await maybeProactiveRefreshBearer(bearer);
    if (replaced) bearer = replaced;
  }
  const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs)) || DEFAULT_TIMEOUT_MS);
  const maxAttempts = Math.max(1, Math.floor(Number(options.attempts)) || MAX_ATTEMPTS);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const reqHeaders: Record<string, string> = { ...headers, accept: 'application/json' };
      if (bearer) reqHeaders.authorization = `Bearer ${bearer}`;
      const res = await fetchWithTimeout(`${base}${suffix}`, timeoutMs, {
        method,
        headers: reqHeaders,
        body: options.body == null ? undefined : JSON.stringify(options.body),
      });
      if (!res.ok) {
        if (
          res.status === 401 &&
          bearer &&
          attempt === 1 &&
          !authPathSkipsRefresh(suffix)
        ) {
          const next = await tryRefreshAccessToken();
          if (next) {
            bearer = next;
            continue;
          }
        }
        const bodyText = await res.text().catch(() => '');
        if (__DEV__) {
          const elapsed = Date.now() - startedAt;
          console.debug(`[Signal API] ${res.status} ${method} ${suffix} ${elapsed}ms`, bodyText.slice(0, 240));
        }
        let serverCode: string | undefined;
        try {
          const parsed = JSON.parse(bodyText) as { error?: string };
          serverCode = typeof parsed?.error === 'string' ? parsed.error : undefined;
        } catch {
          /* ignore */
        }
        const kind: SignalApiErrorKind = res.status >= 500 ? 'server' : 'http';
        throw new SignalApiError(kind, serverCode || `SIGNAL_API_${res.status}`, res.status);
      }
      try {
        const parsed = (await res.json()) as T;
        if (__DEV__) {
          const elapsed = Date.now() - startedAt;
          if (elapsed >= DEV_SLOW_API_LOG_MS) {
            console.debug(`[Signal API] slow ${method} ${suffix} ${elapsed}ms`);
          }
        }
        return parsed;
      } catch {
        throw new SignalApiError('parse', 'SIGNAL_API_PARSE');
      }
    } catch (error) {
      lastError = error;
      if (__DEV__) {
        const elapsed = Date.now() - startedAt;
        const code = error instanceof Error ? error.message : String(error);
        console.debug(`[Signal API] failed ${method} ${suffix} attempt=${attempt}/${maxAttempts} ${elapsed}ms ${code}`);
      }
      if (attempt >= maxAttempts || !isRetriable(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new SignalApiError('network', 'SIGNAL_API_NETWORK');
}

export async function signalApi<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  options?: { timeoutMs?: number; attempts?: number },
): Promise<T> {
  return signalApiRequest<T>(path, { params, ...options });
}
