import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const sourceName = item.source?.trim() || '—';
  const isFlash = Boolean(item.isFlash);
  const symbol = item.ticker?.trim().toUpperCase() ?? '';
  const canOpenSymbol = symbol.length > 0 && symbol !== 'GLOBAL' && symbol !== '—';

  return (
    <View style={[styles.card, isFlash && styles.cardFlash]}>
      {isFlash ? (
        <View style={styles.flashBadgeWrap} accessibilityLabel={t('newsFlashBadge')}>
          <View style={styles.flashBadge}>
            <Text style={styles.flashBadgeText}>{t('newsFlashBadge')}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.row}>
        {canOpenSymbol ? (
          <Pressable onPress={() => router.push(`/symbol/${symbol}`)} hitSlop={6}>
            <Text style={styles.ticker} numberOfLines={1}>
              {item.ticker}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.ticker} numberOfLines={1}>
            {item.ticker}
          </Text>
        )}
        <Text style={styles.time}>{item.timeLabel}</Text>
      </View>
      <View style={styles.sourceRow}>
        <Text style={styles.sourceLabel}>{t('newsSourceLabel')}</Text>
        <View style={styles.sourcePill}>
          <Text style={styles.sourceName} numberOfLines={1}>
            {sourceName}
          </Text>
        </View>
      </View>
      {canOpenSymbol ? (
        <Pressable onPress={() => router.push(`/symbol/${symbol}`)} hitSlop={4}>
          <Text style={styles.title}>{item.titleKo}</Text>
        </Pressable>
      ) : (
        <Text style={styles.title}>{item.titleKo}</Text>
      )}
      <View style={styles.footer}>
        <Text style={styles.aiLabel}>
          {item.summarySource === 'claude'
            ? t('newsAiClaude')
            : item.summarySource === 'openai'
              ? t('newsAiOpenai')
              : t('newsAiFinnhub')}
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
    cardFlash: {
      borderColor: 'rgba(255, 90, 90, 0.45)',
      borderLeftWidth: 3,
      borderLeftColor: '#FF5A5A',
      backgroundColor: 'rgba(255, 90, 90, 0.06)',
    },
    flashBadgeWrap: {
      marginBottom: 10,
    },
    flashBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: 'rgba(255, 80, 80, 0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255, 120, 120, 0.55)',
    },
    flashBadgeText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#FF9A9A',
      letterSpacing: 0.8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    ticker: {
      flex: 1,
      minWidth: 0,
      color: theme.green,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    time: {
      flexShrink: 0,
      color: theme.textDim,
      fontSize: 11,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    sourceLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 0.4,
    },
    sourcePill: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    sourceName: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.text,
    },
    title: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 2,
      lineHeight: 21,
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
