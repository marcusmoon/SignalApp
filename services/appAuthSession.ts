import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SignalAppUser, SignalAuthSession } from '@/integrations/signal-api/auth';

const KEY = '@signal/app_auth_session_v1';

export type StoredAppAuthSession = {
  user: SignalAppUser;
  token: string;
  expiresAt: string;
};

export async function loadAppAuthSession(): Promise<StoredAppAuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAppAuthSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    const expiresMs = new Date(parsed.expiresAt || 0).getTime();
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      await clearAppAuthSession();
      return null;
    }
    return parsed;
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
