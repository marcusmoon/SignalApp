import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalSidebarTabBar } from '@/components/signal/SignalSidebarTabBar';
import { webFlexFill, webShellBackground, webSidebarContentStyle } from '@/constants/webLayout';
import { WebHeaderRefreshProvider, useWebHeaderRefreshTrigger } from '@/contexts/WebHeaderRefreshContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

type Props = {
  children: ReactNode;
};

function WideWebShellFrame({ children }: Props) {
  const { theme } = useSignalTheme();
  const triggerHeaderRefresh = useWebHeaderRefreshTrigger();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: webShellBackground(theme.bg) }]}
      edges={['top']}>
      <SignalHeader
        compact
        fullWidth
        onBrandPress={Platform.OS === 'web' ? () => void triggerHeaderRefresh() : undefined}
      />
      <View style={[styles.body, { backgroundColor: webShellBackground(theme.bg) }]}>
        <SignalSidebarTabBar />
        <View style={[styles.content, { backgroundColor: webShellBackground(theme.bg) }]}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Wide web/iPad: sidebar + header를 루트에 한 번만 두어 스택 전환 시 사이드바가 리마운트되지 않게 한다. */
export function WideWebShell({ children }: Props) {
  const { useTwoPane } = useResponsiveLayout();

  if (!useTwoPane) {
    return <>{children}</>;
  }

  return (
    <WebHeaderRefreshProvider>
      <WideWebShellFrame>{children}</WideWebShellFrame>
    </WebHeaderRefreshProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    ...webFlexFill,
  },
  body: {
    ...webFlexFill,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  content: {
    ...webSidebarContentStyle,
  },
});
