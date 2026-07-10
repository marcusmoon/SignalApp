import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsItem } from '@/types/signal';

type Props = {
  item: NewsItem;
  titleShowAlternate?: boolean;
  titleToggle?: boolean;
};

export function DigestHeadlineRow({ item, titleShowAlternate, titleToggle = false }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const alternateTitle = item.alternateTitle?.trim() ?? '';
  const hasAlternate = titleToggle && alternateTitle.length > 0;
  const showingAlternate = hasAlternate && Boolean(titleShowAlternate);
  const displayTitle = showingAlternate ? alternateTitle : item.titleKo;

  const openArticle = useCallback(() => {
    const url = item.url?.trim();
    if (!url) return;
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => null));
  }, [item.url]);

  const meta = [item.source?.trim(), item.timeLabel].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={openArticle}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={[displayTitle, meta].filter(Boolean).join(', ')}>
      <Text style={styles.bullet}>•</Text>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowPressed: {
      opacity: 0.88,
    },
    bullet: {
      marginTop: 2,
      width: 10,
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '900',
      color: theme.green,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: theme.text,
      fontSize: sf(14),
      lineHeight: sf(20),
      fontWeight: '700',
    },
    meta: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '600',
    },
  });
}
