import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SignalAppUser, SignalAuthSession } from '@/integrations/signal-api/auth';

const KEY = '@signal/app_auth_session_v1';

export type StoredAppAuthSession = SignalAuthSession;

function migrateLegacyShape(parsed: Record<string, unknown>): Record<string, unknown> {
  const token = parsed.accessToken ?? parsed.token;
  const accessExpiresAt = parsed.accessExpiresAt ?? parsed.expiresAt;
  if (typeof token === 'string' && !parsed.accessToken) parsed.accessToken = token;
  if (typeof accessExpiresAt === 'string' && !parsed.accessExpiresAt) parsed.accessExpiresAt = accessExpiresAt;
  if (typeof parsed.refreshExpiresAt !== 'string' && typeof accessExpiresAt === 'string') {
    parsed.refreshExpiresAt = accessExpiresAt;
  }
  return parsed;
}

/** Bearer access token for API calls (supports pre-JWT stored shape). */
export function getSessionAccessToken(s: StoredAppAuthSession | null): string | null {
  if (!s) return null;
  const any = s as SignalAuthSession & { token?: string };
  return s.accessToken || any.token || null;
}

export async function loadAppAuthSession(): Promise<StoredAppAuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = migrateLegacyShape(JSON.parse(raw) as Record<string, unknown>) as StoredAppAuthSession & {
      token?: string;
      expiresAt?: string;
    };
    const access = getSessionAccessToken(parsed as StoredAppAuthSession);
    if (!access || !parsed?.user || !(parsed.user as SignalAppUser).id) return null;
    const hasRefresh = typeof parsed.refreshToken === 'string' && String(parsed.refreshToken).length > 0;
    const accessMs = new Date(String(parsed.accessExpiresAt || '')).getTime();
    if (Number.isFinite(accessMs) && accessMs <= Date.now() && !hasRefresh) {
      await clearAppAuthSession();
      return null;
    }
    return {
      user: parsed.user as SignalAppUser,
      accessToken: parsed.accessToken as string,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
      accessExpiresAt: String(parsed.accessExpiresAt || ''),
      refreshExpiresAt: String(parsed.refreshExpiresAt || parsed.accessExpiresAt || ''),
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : '',
    };
  } catch {
    return null;
  }
}

export async function saveAppAuthSession(session: SignalAuthSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearAppAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
