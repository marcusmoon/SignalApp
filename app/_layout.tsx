import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { NotificationListener } from '@/components/NotificationListener';
import { OtaBannerProvider } from '@/contexts/OtaBannerContext';
import { LocaleProvider, useLocale } from '@/contexts/LocaleContext';
import { SignalThemeProvider, useSignalTheme } from '@/contexts/SignalThemeContext';
import { initializeAds } from '@/services/admob';
import { getPreviewOtaBannerRaw } from '@/services/env';

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

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void initializeAds().catch(() => {});
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <SignalThemeProvider>
      <LocaleProvider>
        <OtaBannerProvider key={`ota-prev-${getPreviewOtaBannerRaw()}`}>
          <RootLayoutNav />
        </OtaBannerProvider>
      </LocaleProvider>
    </SignalThemeProvider>
  );
}

function RootLayoutNav() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
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
          return { headerShown: false };
        }
        if (route.name === 'modal') {
          return {
            presentation: 'modal' as const,
            title: t('screenInfo'),
          };
        }
        const titleByName: Record<string, string> = {
          settings: t('screenSettings'),
          alerts: t('screenAlerts'),
          calendar: t('screenCalendar'),
          'mega-cap-list': t('screenMegaCapList'),
        };
        return {
          title: titleByName[route.name] ?? route.name,
          headerBackTitle: t('commonBack'),
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.green,
          headerTitleStyle: { fontWeight: '800' as const, color: theme.text },
        };
      },
    [t, theme],
  );

  return (
    <ThemeProvider value={navTheme}>
      <NotificationListener />
      <StatusBar style="light" />
      <Stack screenOptions={rootScreenOptions} />
    </ThemeProvider>
  );
}
