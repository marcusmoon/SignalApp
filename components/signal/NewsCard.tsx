import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsItem } from '@/types/signal';

type Props = {
  item: NewsItem;
  /** 0이면 태그 행 숨김 */
  maxHashtagsToShow?: number;
  onTagPress?: (label: string) => void;
};

export function NewsCard({ item, maxHashtagsToShow = 4, onTagPress }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const sourceName = item.source?.trim() || '—';
  const isFlash = Boolean(item.isFlash);
  const symbol = item.ticker?.trim().toUpperCase() ?? '';
  const canOpenSymbol = symbol.length > 0 && symbol !== 'GLOBAL' && symbol !== '—';

  const tags =
    maxHashtagsToShow > 0
      ? (item.hashtags || [])
          .slice()
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .slice(0, maxHashtagsToShow)
      : [];

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
        <View style={[styles.footerRow, tags.length === 0 && styles.footerRowLinkOnly]}>
          {tags.length > 0 ? (
            <View style={styles.footerTagsCol}>
              {tags.map((tag) => (
                <Pressable
                  key={`${item.id}-${tag.label}`}
                  onPress={() => onTagPress?.(tag.label)}
                  disabled={!onTagPress}
                  style={({ pressed }) => [styles.tagChip, pressed && onTagPress && styles.tagChipPressed]}
                  accessibilityRole={onTagPress ? 'button' : 'text'}
                  accessibilityLabel={tag.label}>
                  <Text style={styles.tagChipText}>#{tag.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => {
              void WebBrowser.openBrowserAsync(item.url);
            }}
            style={styles.footerReadMore}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel={t('newsReadMore')}>
            <Text style={styles.link}>{t('newsReadMore')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const linkAndroid = Platform.OS === 'android' ? ({ includeFontPadding: false } as const) : {};
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingTop: 14,
      /** 푸터 아래 빈 띠가 과해 보이지 않도록 하단만 약간 축소 */
      paddingBottom: 6,
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
      fontSize: sf(11),
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
      fontSize: sf(13),
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    time: {
      flexShrink: 0,
      color: theme.textDim,
      fontSize: sf(11),
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    sourceLabel: {
      fontSize: sf(10),
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
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.text,
    },
    title: {
      color: theme.text,
      fontSize: sf(15),
      fontWeight: '700',
      marginBottom: 6,
      lineHeight: sf(21),
    },
    footerTagsCol: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      alignItems: 'center',
      alignContent: 'center',
      justifyContent: 'flex-start',
      paddingRight: 4,
    },
    /** 인스타그램 등 링크형 해시태그와 비슷한 블루 톤 — 본문(제목)과 색·채도로 구분 */
    tagChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 7,
      backgroundColor: 'rgba(77, 159, 255, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(77, 159, 255, 0.28)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagChipPressed: {
      opacity: 1,
      backgroundColor: 'rgba(77, 159, 255, 0.2)',
      borderColor: 'rgba(77, 159, 255, 0.45)',
    },
    tagChipText: {
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '600',
      letterSpacing: 0.1,
      color: '#9EC9FF',
      textAlignVertical: Platform.OS === 'android' ? 'center' : undefined,
    },
    footer: {
      marginTop: 6,
      paddingTop: 8,
      paddingBottom: 2,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    /** 태그·원문 보기 — 푸터 패딩 안에서 세로 중앙 */
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    footerRowLinkOnly: {
      justifyContent: 'flex-end',
    },
    footerReadMore: {
      flexShrink: 0,
      justifyContent: 'center',
    },
    link: {
      fontSize: sf(12),
      lineHeight: sf(14),
      fontWeight: '700',
      color: theme.green,
      ...linkAndroid,
      textAlignVertical: Platform.OS === 'android' ? 'center' : undefined,
    },
  });
}
