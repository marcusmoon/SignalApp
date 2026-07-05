import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { webShellBackground } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadMainEntry, mainEntryHref } from '@/services/mainEntryPreference';

/** 홈 탭 제거 — 저장된 첫 화면 설정 또는 뉴스로 보냅니다. */
export default function TabsIndexRedirect() {
  const { theme } = useSignalTheme();
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    void loadMainEntry().then((key) => {
      setTarget((mainEntryHref(key) ?? '/home') as Href);
    });
  }, []);

  if (!target) {
    return <View style={{ flex: 1, backgroundColor: webShellBackground(theme.bg) }} />;
  }
  return <Redirect href={target} />;
}
