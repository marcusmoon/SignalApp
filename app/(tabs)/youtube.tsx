import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router/react-navigation';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import {
  YoutubeFeedPanel,
  type YoutubeFeedPanelHandle,
} from '@/components/youtube/YoutubeFeedPanel';
import { webFlexFill, webShellBackground } from '@/constants/webLayout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { usePhoneMoreStackChrome } from '@/contexts/PhoneMoreStackChromeContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export default function YoutubeScreen() {
  const { theme } = useSignalTheme();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const stackChrome = usePhoneMoreStackChrome();
  const panelRef = useRef<YoutubeFeedPanelHandle>(null);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: webShellBackground(theme.bg) }]}
      edges={useTwoPane || stackChrome ? [] : ['top']}>
      {!useTwoPane && !stackChrome ? (
        <SignalHeader compact onBrandPress={() => panelRef.current?.refresh()} />
      ) : null}
      {isFocused ? <OtaUpdateBanner /> : null}
      <YoutubeFeedPanel ref={panelRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...webFlexFill },
});
