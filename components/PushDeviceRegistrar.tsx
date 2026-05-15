import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { registerPushDeviceIfPossible } from '@/services/pushDeviceRegistration';

export function PushDeviceRegistrar() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void registerPushDeviceIfPossible();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerPushDeviceIfPossible();
    });
    return () => sub.remove();
  }, []);

  return null;
}
