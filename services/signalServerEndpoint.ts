import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/signal_server_endpoint_v1';

/** 로컬 개발용 기본 Signal 서버 */
export const SIGNAL_SERVER_PRESET_DEV = 'http://127.0.0.1:4000';
/** 프로덕션 배포 기본 호스트 */
export const SIGNAL_SERVER_PRESET_REAL = 'https://signalapp.up.railway.app';

export type SignalServerMode = 'bundle' | 'dev' | 'real' | 'custom';

export const SIGNAL_SERVER_MODES: SignalServerMode[] = ['bundle', 'dev', 'real', 'custom'];

type Stored = {
  mode: SignalServerMode;
  customUrl?: string;
};

const BUNDLE_URL = (process.env.EXPO_PUBLIC_SIGNAL_API_BASE_URL ?? '').trim();

/** 저장값이 없을 때는 번들(.env) 모드를 씁니다. */
let cachedMode: SignalServerMode = 'bundle';
let cachedCustomUrl = '';
let hydrated = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeSignalServerEndpointChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeBaseUrl(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '');
}

function computeEffectiveUrl(): string {
  switch (cachedMode) {
    case 'bundle':
      return normalizeBaseUrl(BUNDLE_URL);
    case 'dev':
      return SIGNAL_SERVER_PRESET_DEV;
    case 'real':
      return SIGNAL_SERVER_PRESET_REAL;
    case 'custom': {
      const u = normalizeBaseUrl(cachedCustomUrl);
      if (u) return u;
      return normalizeBaseUrl(BUNDLE_URL);
    }
    default:
      return normalizeBaseUrl(BUNDLE_URL);
  }
}

/** 번들 시점 `EXPO_PUBLIC_SIGNAL_API_BASE_URL` (오버라이드 없음) */
export function getBundleSignalApiBaseUrl(): string {
  return normalizeBaseUrl(BUNDLE_URL);
}

/** 현재 적용 중인 Signal API 베이스 URL */
export function getEffectiveSignalApiBaseUrl(): string {
  return computeEffectiveUrl();
}

/** 연결 확인에 쓸 대상 URL (모드·커스텀 초안 기준) */
export function resolveSignalServerProbeTarget(
  mode: SignalServerMode,
  customUrlDraft: string,
): string {
  switch (mode) {
    case 'bundle':
      return normalizeBaseUrl(BUNDLE_URL);
    case 'dev':
      return SIGNAL_SERVER_PRESET_DEV;
    case 'real':
      return SIGNAL_SERVER_PRESET_REAL;
    case 'custom':
      return normalizeBaseUrl(customUrlDraft);
    default:
      return normalizeBaseUrl(BUNDLE_URL);
  }
}

/** `GET {base}/health` 로 Signal 서버 응답 확인 (타임아웃 10s) */
export async function probeSignalServerBaseUrl(baseUrl: string): Promise<void> {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) {
    throw new Error('EMPTY_URL');
  }
  const url = `${base}/health`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(url, { method: 'GET', signal: ac.signal });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }
  } finally {
    clearTimeout(tid);
  }
}

export function hasSignalApiEndpoint(): boolean {
  return getEffectiveSignalApiBaseUrl().trim().length > 0;
}

export async function hydrateSignalServerEndpoint(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Stored;
      if (p && (p.mode === 'bundle' || p.mode === 'dev' || p.mode === 'real' || p.mode === 'custom')) {
        cachedMode = p.mode;
        cachedCustomUrl = String(p.customUrl ?? '').trim();
      } else {
        cachedMode = 'bundle';
        cachedCustomUrl = '';
      }
    } else {
      cachedMode = 'bundle';
      cachedCustomUrl = '';
    }
  } catch {
    cachedMode = 'bundle';
    cachedCustomUrl = '';
  }
  hydrated = true;
  notify();
}

export async function loadSignalServerPrefs(): Promise<{ mode: SignalServerMode; customUrl: string }> {
  if (!hydrated) await hydrateSignalServerEndpoint();
  return { mode: cachedMode, customUrl: cachedCustomUrl };
}

export async function saveSignalServerPrefs(next: {
  mode: SignalServerMode;
  customUrl?: string;
}): Promise<void> {
  cachedMode = next.mode;
  if (next.mode === 'custom') {
    if (next.customUrl !== undefined) {
      cachedCustomUrl = String(next.customUrl).trim();
    }
  } else {
    cachedCustomUrl = '';
  }
  const payload: Stored = { mode: cachedMode };
  if (cachedMode === 'custom') {
    payload.customUrl = cachedCustomUrl;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  notify();
}
