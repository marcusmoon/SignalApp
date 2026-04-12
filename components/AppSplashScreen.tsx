import { useMemo } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';

import { SIGNAL } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';

/**
 * 폰트·아이콘 로딩 전 전체 화면 스플래시. 네이티브 스플래시(app.json)와 톤을 맞춤.
 */
export function AppSplashScreen() {
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(), []);
  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoRing}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../assets/images/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.wordmark} accessibilityRole="header">
          SIGNAL
        </Text>
        <Text style={styles.tagline}>{t('headerTagline')}</Text>
        <ActivityIndicator
          color={SIGNAL.green}
          size="small"
          style={styles.spinner}
          accessibilityLabel={t('commonLoadingA11y')}
        />
      </View>
    </View>
  );
}

function makeStyles() {
  const padTop = Platform.select({ ios: 64, android: 56, default: 48 });
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: SIGNAL.bg,
      paddingTop: padTop,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    logoRing: {
      width: 112,
      height: 112,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: SIGNAL.greenBorder,
      backgroundColor: SIGNAL.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },
    logo: {
      width: 72,
      height: 72,
    },
    wordmark: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 4,
      color: SIGNAL.green,
      marginBottom: 10,
    },
    tagline: {
      fontSize: 14,
      fontWeight: '600',
      color: SIGNAL.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      letterSpacing: -0.2,
      maxWidth: 280,
    },
    spinner: {
      marginTop: 36,
    },
  });
}
