import * as SystemUI from 'expo-system-ui';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * Android·웹: expo-status-bar.
 * iOS: RN/expo StatusBar는 plist `UIViewControllerBasedStatusBarAppearance=NO` 가 필요하고,
 * react-native-screens 는 YES 가 필요해 양립할 수 없음 → iOS 는 `app/_layout` Stack `statusBarStyle` 사용.
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
