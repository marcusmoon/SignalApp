import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerSignalAppDevice } from '@/integrations/signal-api/auth';
import { hasSignalApi } from '@/services/env';
import { getSessionAccessToken, loadAppAuthSession } from '@/services/appAuthSession';
import { loadNotificationPrefs } from '@/services/notificationPreferences';

const LAST_REGISTERED_KEY = '@signal/push_device_last_registered_v1';

function expoProjectId(): string | undefined {
  const anyConstants = Constants as typeof Constants & {
    easConfig?: { projectId?: string };
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
  };
  return anyConstants.easConfig?.projectId || anyConstants.expoConfig?.extra?.eas?.projectId || undefined;
}

async function expoPushToken(): Promise<string | null> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const projectId = expoProjectId();
  const response = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return response.data || null;
}

export async function registerPushDeviceIfPossible(): Promise<boolean> {
  if (Platform.OS === 'web' || !hasSignalApi()) return false;
  const prefs = await loadNotificationPrefs();
  if (!prefs.pushEnabled) return false;
  const session = await loadAppAuthSession();
  const token = getSessionAccessToken(session);
  if (!token || !session?.user?.id) return false;
  try {
    const pushToken = await expoPushToken();
    if (!pushToken) return false;
    const cacheKey = `${session.user.id}:${Platform.OS}:${pushToken}`;
    const lastRegistered = await AsyncStorage.getItem(LAST_REGISTERED_KEY);
    if (lastRegistered === cacheKey) return true;
    await registerSignalAppDevice(token, {
      platform: Platform.OS,
      pushToken,
      deviceName: Platform.select({ ios: 'iPhone', android: 'Android', default: Platform.OS }) || Platform.OS,
    });
    await AsyncStorage.setItem(LAST_REGISTERED_KEY, cacheKey);
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[push] device registration failed', error);
    return false;
  }
}
