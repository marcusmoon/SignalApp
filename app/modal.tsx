import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export default function ModalScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('modalInfoTitle')}</Text>
        <Text style={styles.p}>{t('modalInfoBody')}</Text>
        <Text style={styles.sub}>{t('modalInfoNext')}</Text>
        <Text style={styles.p}>{t('modalInfoNextBody')}</Text>
      </ScrollView>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'light'} />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    scroll: { paddingBottom: 32 },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 12,
    },
    sub: {
      marginTop: 16,
      fontSize: 13,
      fontWeight: '800',
      color: theme.green,
      marginBottom: 6,
    },
    p: {
      fontSize: 14,
      color: theme.textMuted,
      lineHeight: 22,
    },
  });
}
