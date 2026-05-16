import * as SystemUI from 'expo-system-ui';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * Android·웹: expo-status-bar.
 * iOS: `UIViewControllerBasedStatusBarAppearance=YES` 상태에서는 expo/RN StatusBar가 충돌하므로
 * Stack의 `statusBarStyle`만 사용하고 이 컴포넌트는 렌더링하지 않는다.
 */
export function ThemedStatusBar() {
  const { theme, effectiveColorScheme } = useSignalTheme();
  const isDark = effectiveColorScheme === 'dark';
  const expoStyle = isDark ? 'light' : 'dark';
  const rnBarStyle = isDark ? 'light-content' : 'dark-content';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(theme.bg);
  }, [theme.bg]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    RNStatusBar.setBarStyle(rnBarStyle, true);
    RNStatusBar.setBackgroundColor(theme.bg);
  }, [rnBarStyle, theme.bg]);

  if (Platform.OS === 'ios') {
    return null;
  }

  return <ExpoStatusBar style={expoStyle} backgroundColor={theme.bg} />;
}
