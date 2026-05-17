import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { SIGNAL_DARK } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';

/**
 * 폰트·아이콘 로딩 전 전체 화면 스플래시.
 * 네이티브 스플래시와 같은 고정 브랜드 톤을 써서 JS 로딩 전후 전환을 줄인다.
 */
export function AppSplashScreen() {
  const { t } = useLocale();
  const theme = SIGNAL_DARK;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(theme.bg);
  }, [theme.bg]);

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
        <Text style={styles.description}>{t('splashDescription')}</Text>
        <ActivityIndicator
          color={theme.green}
          size="small"
          style={styles.spinner}
          accessibilityLabel={t('commonLoadingA11y')}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const padTop = Platform.select({ ios: 64, android: 56, default: 48 });
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingTop: padTop,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    logoRing: {
      width: 132,
      height: 132,
      borderRadius: 34,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    logo: {
      width: 108,
      height: 108,
      borderRadius: 26,
    },
    wordmark: {
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 4,
      color: theme.green,
      marginBottom: 10,
    },
    tagline: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      letterSpacing: -0.2,
      maxWidth: 280,
    },
    description: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '500',
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 19,
      letterSpacing: -0.15,
      maxWidth: 300,
      opacity: 0.88,
    },
    spinner: {
      marginTop: 28,
    },
  });
}
