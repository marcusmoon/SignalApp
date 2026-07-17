import { Redirect, useRootNavigationState, type Href } from 'expo-router';
import { View } from 'react-native';

import { webShellBackground } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

/** 탭 루트는 항상 홈으로 보낸다. */
export default function TabsIndexRedirect() {
  const { theme } = useSignalTheme();
  const navReady = Boolean(useRootNavigationState()?.key);

  if (!navReady) {
    return <View style={{ flex: 1, backgroundColor: webShellBackground(theme.bg) }} />;
  }
  return <Redirect href={'/home' as Href} />;
}
