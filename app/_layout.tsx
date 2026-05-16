import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import 'react-native-reanimated';

import '@/tasks/newsUnreadBackgroundTask';

import { AppSplashScreen } from '@/components/AppSplashScreen';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { NotificationListener } from '@/components/NotificationListener';
import { PushDeviceRegistrar } from '@/components/PushDeviceRegistrar';
import { OtaBannerProvider } from '@/contexts/OtaBannerContext';
import { LocaleProvider, useLocale } from '@/contexts/LocaleContext';
import { SignalThemeProvider, useSignalTheme } from '@/contexts/SignalThemeContext';
import { bootstrapThemeForColorScheme } from '@/constants/theme';
import { ensureStoredSessionFresh } from '@/integrations/signal-api/httpClient';
import { getPreviewOtaBannerRaw } from '@/services/env';
import { initializeAds } from '@/integrations/admob/initializeAds';
import { startNewsUnreadBackgroundSync } from '@/services/newsUnreadBackground';
import {
  hydrateSignalServerEndpoint,
  subscribeSignalServerEndpointChanged,
} from '@/services/signalServerEndpoint';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/** 탭·스택에서 react-freeze 기본 활성화 시 복귀 화면이 비는 이슈 완화 */
if (Platform.OS !== 'web') {
  enableFreeze(false);
}

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const bootstrapBg = bootstrapThemeForColorScheme(systemScheme).bg;
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [signalEndpointReady, setSignalEndpointReady] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    void hydrateSignalServerEndpoint().then(() => setSignalEndpointReady(true));
  }, []);

  useEffect(() => {
    if (loaded && signalEndpointReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, signalEndpointReady]);

  useEffect(() => {
    void initializeAds().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bootstrapBg }}>
      <LocaleProvider>
        {!loaded || !signalEndpointReady ? (
          <AppSplashScreen />
        ) : (
          <SignalThemeProvider>
            <OtaBannerProvider key={`ota-prev-${getPreviewOtaBannerRaw()}`}>
              <RootLayoutNav />
            </OtaBannerProvider>
          </SignalThemeProvider>
        )}
      </LocaleProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const [_signalUrlTick, setSignalUrlTick] = useState(0);
  useEffect(() => {
    return subscribeSignalServerEndpointChanged(() => {
      setSignalUrlTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    void ensureStoredSessionFresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ensureStoredSessionFresh();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => startNewsUnreadBackgroundSync(), []);

  const { theme, effectiveColorScheme } = useSignalTheme();
  const { t } = useLocale();
  /** iOS: react-native-screens — plist `UIViewControllerBasedStatusBarAppearance` must be YES */
  const statusBarStyle = effectiveColorScheme === 'dark' ? ('light' as const) : ('dark' as const);
  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: theme.green,
        background: theme.bg,
        card: theme.bgElevated,
        text: theme.text,
        border: theme.border,
        notification: theme.green,
      },
    }),
    [theme],
  );

  const rootScreenOptions = useMemo(
    () =>
      ({ route }: { route: { name: string } }) => {
        if (route.name === '(tabs)') {
          return { headerShown: false, statusBarStyle };
        }
        if (route.name === 'modal') {
          return {
            presentation: 'modal' as const,
            title: t('screenInfo'),
            statusBarStyle,
          };
        }
        const titleByName: Record<string, string> = {
          settings: t('screenSettings'),
          account: t('screenAccount'),
          alerts: t('screenAlerts'),
          calendar: t('screenCalendar'),
          calls: t('callsSectionTitle'),
          briefing: t('screenBriefing'),
          insights: t('screenInsights'),
          market: t('screenMarket'),
          terms: t('termsScreenTitle'),
          'terms-history': t('termsHistoryScreenTitle'),
          oauth: t('screenAccount'),
          'mega-cap-list': t('screenMegaCapList'),
          'symbol/[ticker]': t('screenSymbolDetail'),
        };
        return {
          title: titleByName[route.name] ?? route.name,
          headerBackTitle: t('commonBack'),
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.green,
          headerTitleStyle: { fontWeight: '800' as const, color: theme.text },
          statusBarStyle,
        };
      },
    [statusBarStyle, t, theme],
  );

  return (
    <ThemeProvider value={navTheme}>
      <NotificationListener />
      <PushDeviceRegistrar />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ThemedStatusBar />
        <Stack screenOptions={rootScreenOptions} />
      </View>
    </ThemeProvider>
  );
}
