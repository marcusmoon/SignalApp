import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsItem } from '@/types/signal';

type Props = { item: NewsItem };

export function NewsCard({ item }: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.ticker}>{item.ticker}</Text>
        <Text style={styles.meta}>
          {item.source} · {item.timeLabel}
        </Text>
      </View>
      <Text style={styles.title}>{item.titleKo}</Text>
      {item.summaryLines.map((line, i) => (
        <Text key={i} style={styles.line}>
          · {line}
        </Text>
      ))}
      <View style={styles.footer}>
        <Text style={styles.aiLabel}>
          {item.summarySource === 'claude' ? t('newsAiClaude') : t('newsAiFinnhub')}
        </Text>
        <Pressable
          onPress={() => {
            void WebBrowser.openBrowserAsync(item.url);
          }}
          accessibilityRole="link"
          accessibilityLabel={t('newsReadMore')}>
          <Text style={styles.link}>{t('newsReadMore')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    ticker: {
      color: theme.green,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    meta: {
      color: theme.textDim,
      fontSize: 11,
    },
    title: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
      lineHeight: 21,
    },
    line: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 4,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    aiLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textDim,
      letterSpacing: 0.3,
    },
    link: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.green,
    },
  });
}
