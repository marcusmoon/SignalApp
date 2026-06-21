import * as SystemUI from 'expo-system-ui';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * Android·웹: expo-status-bar.
 * iOS: `UIViewControllerBasedStatusBarAppearance=YES` 기준으로 Stack의 `statusBarStyle`만 사용한다.
 * RNStatusBar iOS 호출은 plist NO를 요구해 런타임 경고/에러를 만들 수 있다.
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

  return <ExpoStatusBar style={expoStyle} />;
}
