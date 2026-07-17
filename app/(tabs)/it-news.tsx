import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router/react-navigation';

import { ItNewsFeedPanel, type ItNewsFeedPanelHandle } from '@/components/news/ItNewsFeedPanel';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { webFlexFill, webShellBackground } from '@/constants/webLayout';
import { usePhoneMoreStackChrome } from '@/contexts/PhoneMoreStackChromeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export default function ItNewsScreen() {
  const { theme } = useSignalTheme();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const stackChrome = usePhoneMoreStackChrome();
  const panelRef = useRef<ItNewsFeedPanelHandle | null>(null);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: webShellBackground(theme.bg) }]}
      edges={useTwoPane || stackChrome ? [] : ['top']}>
      {!useTwoPane && !stackChrome ? (
        <SignalHeader compact onBrandPress={() => panelRef.current?.refresh()} />
      ) : null}
      {isFocused ? <OtaUpdateBanner /> : null}
      <ItNewsFeedPanel panelRef={panelRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...webFlexFill },
});
