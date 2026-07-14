import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const authCompletion = WebBrowser.maybeCompleteAuthSession({
  // Server may rewrite `/oauth` → `/web/oauth`; still same origin and session handle.
  skipRedirectCheck: Platform.OS === 'web',
});

export default function OAuthReturnScreen() {
  const router = useRouter();
  const ipadNav = useIpadSidebarNavActions();
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  useEffect(() => {
    if (__DEV__ && authCompletion.type === 'failed') {
      console.warn('[oauth]', authCompletion.message);
    }

    // OAuth popup: parent tab completes login; do not show account inside the popup.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
      return;
    }

    const timer = setTimeout(() => {
      if (ipadNav.isAvailable) {
        ipadNav.showAccount();
        return;
      }
      router.replace('/account');
    }, 450);
    return () => clearTimeout(timer);
  }, [ipadNav, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.title}>{t('oauthReturnTitle')}</Text>
        <Text style={styles.body}>{t('commonLoading')}</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useSignalTheme>['theme'], scaleFont: (size: number) => number) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      color: theme.text,
      fontSize: scaleFont(18),
      fontWeight: '700',
      textAlign: 'center',
    },
    body: {
      marginTop: 8,
      color: theme.textDim,
      fontSize: scaleFont(13),
      textAlign: 'center',
    },
  });
}
