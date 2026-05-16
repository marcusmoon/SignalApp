import * as SystemUI from 'expo-system-ui';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * 라이트 테마에서 iOS 상태 표시줄(시계·배터리)이 안 보이는 문제 방지.
 * `app.json`의 `userInterfaceStyle`과 expo-status-bar·RN StatusBar를 함께 맞춘다.
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
    if (Platform.OS === 'web') return;
    RNStatusBar.setBarStyle(rnBarStyle, true);
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor(theme.bg);
    }
  }, [rnBarStyle, theme.bg]);

  return <ExpoStatusBar style={expoStyle} backgroundColor={theme.bg} />;
}
