import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, InteractionManager, LogBox, Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import 'react-native-reanimated';

import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { NotificationListener } from '@/components/NotificationListener';
import { PushDeviceRegistrar } from '@/components/PushDeviceRegistrar';
import { OtaBannerProvider } from '@/contexts/OtaBannerContext';
import { LocaleProvider, useLocale } from '@/contexts/LocaleContext';
import { SignalThemeProvider, useSignalTheme } from '@/contexts/SignalThemeContext';
import { SidebarSubTabsProvider } from '@/contexts/SidebarSubTabsContext';
import { bootstrapThemeForColorScheme } from '@/constants/theme';
import { webFlexFill } from '@/constants/webLayout';
import { ensureStoredSessionFresh } from '@/integrations/signal-api/httpClient';
import { getPreviewOtaBannerRaw } from '@/services/env';
import { runAppBootstrap, SPLASH_MIN_DISPLAY_MS } from '@/services/appBootstrap';
import { startNewsUnreadBackgroundSync } from '@/services/newsUnreadBackground';
import {
  subscribeSignalServerEndpointChanged,
} from '@/services/signalServerEndpoint';
import {
  readWebThemeAppearanceMode,
  resolveThemeColorScheme,
  themeBackgroundForScheme,
} from '@/utils/webThemeDocument';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

/** 탭·스택에서 react-freeze 기본 활성화 시 복귀 화면이 비는 이슈 완화 */
if (Platform.OS !== 'web') {
  enableFreeze(false);
}

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const splashShownAt = useRef(Date.now());
  const bootstrapBg = useMemo(() => {
    if (Platform.OS === 'web') {
      const scheme = resolveThemeColorScheme(readWebThemeAppearanceMode());
      return themeBackgroundForScheme(scheme);
    }
    return bootstrapThemeForColorScheme(
      systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : null,
    ).bg;
  }, [systemScheme]);
  const [fontsLoaded, fontError] = useFonts(FontAwesome.font);
  const [bootstrapReady, setBootstrapReady] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    void runAppBootstrap().finally(() => setBootstrapReady(true));
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !bootstrapReady) return;

    let cancelled = false;
    const hideSplash = () => {
      if (!cancelled) void SplashScreen.hideAsync();
    };

    const elapsed = Date.now() - splashShownAt.current;
    const minDelay = Math.max(0, SPLASH_MIN_DISPLAY_MS - elapsed);
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(hideSplash);
    }, minDelay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fontsLoaded, bootstrapReady]);

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: bootstrapBg,
        ...(Platform.OS === 'web' ? { height: '100%', overflow: 'hidden' as const } : null),
      }}>
      <LocaleProvider>
        <SignalThemeProvider>
          <SidebarSubTabsProvider>
            <OtaBannerProvider key={`ota-prev-${getPreviewOtaBannerRaw()}`}>
              <RootLayoutNav />
            </OtaBannerProvider>
          </SidebarSubTabsProvider>
        </SignalThemeProvider>
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
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ensureStoredSessionFresh();
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    const deferred = InteractionManager.runAfterInteractions(() => {
      stopSync = startNewsUnreadBackgroundSync();
    });
    return () => {
      deferred.cancel();
      stopSync?.();
    };
  }, []);

  const { theme, effectiveColorScheme } = useSignalTheme();
  const { t } = useLocale();
  /**
   * iOS standalone/dev-client: react-native-screens `statusBarStyle` 사용, plist YES 필요.
   * Expo Go는 native Info.plist를 통제할 수 없어 RNSScreen statusBarStyle 전달 금지.
   */
  const statusBarStyle = effectiveColorScheme === 'dark' ? ('light' as const) : ('dark' as const);
  const canUseScreenStatusBar = Platform.OS !== 'ios' || !isRunningInExpoGo();
  const screenStatusBarOptions = useMemo(
    () => (canUseScreenStatusBar ? { statusBarStyle } : {}),
    [canUseScreenStatusBar, statusBarStyle],
  );
  const navTheme = useMemo(
    () => {
      const base = effectiveColorScheme === 'dark' ? DarkTheme : DefaultTheme;
      return {
        ...base,
        dark: effectiveColorScheme === 'dark',
        colors: {
          ...base.colors,
          primary: theme.green,
          background: theme.bg,
          card: theme.bgElevated,
          text: theme.text,
          border: theme.border,
          notification: theme.green,
        },
      };
    },
    [effectiveColorScheme, theme],
  );

  const rootScreenOptions = useMemo(
    () =>
      ({ route }: { route: { name: string } }) => {
        if (route.name === '(tabs)') {
          return { headerShown: false, ...screenStatusBarOptions };
        }
        const titleByName: Record<string, string> = {
          settings: t('screenSettings'),
          account: t('screenAccount'),
          alerts: t('screenAlerts'),
          calendar: t('screenCalendar'),
          'today-briefing': t('ipadHomeTitle'),
          'news-issues': t('newsIssuesTitle'),
          terms: t('termsScreenTitle'),
          'terms-history': t('termsHistoryScreenTitle'),
          oauth: t('screenAccount'),
          'symbol/[ticker]': t('screenSymbolDetail'),
          'disclosures/[id]': t('disclosuresDetailTitle'),
        };
        return {
          title: titleByName[route.name] ?? route.name,
          headerBackTitle: t('commonBack'),
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.green,
          headerTitleStyle: { fontWeight: '800' as const, color: theme.text },
          ...screenStatusBarOptions,
        };
      },
    [screenStatusBarOptions, t, theme],
  );

  return (
    <ThemeProvider value={navTheme}>
      <NotificationListener />
      <PushDeviceRegistrar />
      <View style={{ ...webFlexFill, backgroundColor: theme.bg }}>
        <ThemedStatusBar />
        <Stack screenOptions={rootScreenOptions} />
      </View>
    </ThemeProvider>
  );
}
