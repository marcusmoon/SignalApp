import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { bootstrapThemeForColorScheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';

/**
 * 폰트·아이콘 로딩 전 전체 화면 스플래시. 네이티브 스플래시(app.json)와 톤을 맞춤.
 * SignalThemeProvider 밖이므로 저장된 테마 대신 시스템 컬러 스킴을 따른다.
 */
export function AppSplashScreen() {
  const { t } = useLocale();
  const scheme = useColorScheme();
  const theme = bootstrapThemeForColorScheme(scheme);
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
      width: 112,
      height: 112,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
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
    spinner: {
      marginTop: 36,
    },
  });
}
