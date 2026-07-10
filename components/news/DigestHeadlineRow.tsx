import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsItem } from '@/types/signal';

type Props = {
  item: NewsItem;
  titleShowAlternate?: boolean;
  titleToggle?: boolean;
};

export function DigestHeadlineRow({ item, titleShowAlternate, titleToggle = false }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const listTitleMode = titleShowAlternate !== undefined;
  const [localShowAlternate, setLocalShowAlternate] = useState(false);

  const alternateTitle = item.alternateTitle?.trim() ?? '';
  const hasAlternate = titleToggle && alternateTitle.length > 0;
  const showAlternate = listTitleMode ? Boolean(titleShowAlternate) : localShowAlternate;
  const showingAlternate = hasAlternate && showAlternate;
  const displayTitle = showingAlternate ? alternateTitle : item.titleKo;
  const alternateIsTranslation = locale === 'en';
  const showPerItemToggle = hasAlternate && !listTitleMode;

  useEffect(() => {
    if (listTitleMode) return;
    setLocalShowAlternate(false);
  }, [item.id, listTitleMode]);

  const openArticle = useCallback(() => {
    const url = item.url?.trim();
    if (!url) return;
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => null));
  }, [item.url]);

  const meta = [item.source?.trim(), item.timeLabel].filter(Boolean).join(' · ');

  const titleToggleA11y = showingAlternate
    ? t('newsTitleShowLocalized')
    : alternateIsTranslation
      ? t('newsTitleShowTranslation')
      : t('newsTitleShowOriginal');

  const titleToggleBtn = showPerItemToggle ? (
    <Pressable
      onPress={() => setLocalShowAlternate((value) => !value)}
      hitSlop={8}
      style={({ pressed }) => [
        styles.titleToggleBtn,
        showingAlternate && styles.titleToggleBtnActive,
        pressed && styles.titleToggleBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: showingAlternate }}
      accessibilityLabel={titleToggleA11y}>
      <FontAwesome
        name={alternateIsTranslation ? 'language' : 'globe'}
        size={12}
        color={showingAlternate ? theme.green : theme.textMuted}
      />
    </Pressable>
  ) : null;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={openArticle}
        style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
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
      {titleToggleBtn}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowPress: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 7,
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
    titleToggleBtn: {
      flexShrink: 0,
      marginTop: 5,
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    titleToggleBtnActive: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    titleToggleBtnPressed: {
      opacity: 0.82,
    },
  });
}
