import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
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
  /** `grouped`: 홈 관련 근거처럼 한 카드 안 행 구분(개별 테두리 없음) */
  layout?: 'card' | 'grouped';
};

export function NewsCard({ item, maxHashtagsToShow = 4, onTagPress, layout = 'card' }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const sourceName = item.source?.trim() || '—';
  const isFlash = Boolean(item.isFlash);
  const symbol = item.ticker?.trim().toUpperCase() ?? '';
  const showSourceInHeader =
    symbol.length === 0 || symbol === 'GLOBAL' || symbol === '—';
  const canOpenSymbol = !showSourceInHeader;
  const headerLabel = showSourceInHeader ? sourceName : item.ticker;

  const tags =
    maxHashtagsToShow > 0
      ? (item.hashtags || [])
          .slice()
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .slice(0, maxHashtagsToShow)
      : [];

  const grouped = layout === 'grouped';
  const articleUrl = item.url?.trim() ?? '';
  const canOpenArticle = articleUrl.length > 0;

  const openArticle = useCallback(() => {
    if (!canOpenArticle) return;
    void WebBrowser.openBrowserAsync(articleUrl);
  }, [articleUrl, canOpenArticle]);

  const sourceA11y = canOpenArticle ? `${sourceName}, ${t('newsReadMore')}` : sourceName;

  const sourceContent = (
    <View style={[styles.sourcePill, canOpenArticle && styles.sourcePillPressable]}>
      <Text style={styles.sourceName} numberOfLines={1}>
        {sourceName}
      </Text>
      {canOpenArticle ? (
        <Text style={styles.sourceOpenHint} accessibilityElementsHidden importantForAccessibility="no">
          ↗
        </Text>
      ) : null}
    </View>
  );

  const renderSourceBlock = (compact: boolean) => {
    const rowStyle = [
      styles.sourceRow,
      compact && styles.sourceRowCompact,
      canOpenArticle && styles.sourceRowPressable,
      compact && canOpenArticle && styles.sourceRowPressableCompact,
    ];
    if (canOpenArticle) {
      return (
        <Pressable
          onPress={openArticle}
          style={({ pressed }) => [...rowStyle, pressed && styles.sourceRowPressed]}
          accessibilityRole="link"
          accessibilityLabel={sourceA11y}>
          {sourceContent}
        </Pressable>
      );
    }
    return <View style={rowStyle}>{sourceContent}</View>;
  };

  return (
    <View style={[styles.card, grouped && styles.cardGrouped, isFlash && styles.cardFlash]}>
      {isFlash ? (
        <View style={styles.flashBadgeWrap} accessibilityLabel={t('newsFlashBadge')}>
          <View style={styles.flashBadge}>
            <Text style={styles.flashBadgeText}>{t('newsFlashBadge')}</Text>
          </View>
        </View>
      ) : null}
      <View style={[styles.row, showSourceInHeader && styles.rowWithSource]}>
        {canOpenSymbol ? (
          <Pressable onPress={() => router.push(`/symbol/${symbol}`)} hitSlop={6} style={styles.metaLead}>
            <Text style={styles.ticker} numberOfLines={1}>
              {headerLabel}
            </Text>
          </Pressable>
        ) : (
          renderSourceBlock(true)
        )}
        <View style={styles.timePill}>
          <Text style={styles.time}>{item.timeLabel}</Text>
        </View>
      </View>
      {canOpenSymbol ? renderSourceBlock(false) : null}
      {canOpenSymbol ? (
        <Pressable onPress={() => router.push(`/symbol/${symbol}`)} hitSlop={4}>
          <Text style={[styles.title, tags.length === 0 && styles.titleLast]}>{item.titleKo}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.title, tags.length === 0 && styles.titleLast]}>{item.titleKo}</Text>
      )}
      {tags.length > 0 ? (
        <View style={[styles.footer, grouped && styles.footerGrouped]}>
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
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
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
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      marginBottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
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
    rowWithSource: {
      marginBottom: 10,
    },
    metaLead: {
      flex: 1,
      minWidth: 0,
    },
    ticker: {
      flexShrink: 1,
      color: theme.green,
      fontSize: sf(13),
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    timePill: {
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    time: {
      color: theme.textMuted,
      fontSize: sf(10),
      fontWeight: '600',
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    sourceRowCompact: {
      flexShrink: 1,
      minWidth: 0,
      marginBottom: 0,
      alignSelf: 'center',
    },
    sourceRowPressable: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    sourceRowPressableCompact: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    sourceRowPressed: {
      opacity: 0.88,
    },
    sourcePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      maxWidth: '100%',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    sourcePillPressable: {
      paddingRight: 8,
    },
    sourceName: {
      flexShrink: 1,
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.text,
      maxWidth: '100%',
    },
    sourceOpenHint: {
      flexShrink: 0,
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.green,
      marginTop: 1,
    },
    title: {
      color: theme.text,
      fontSize: sf(15),
      fontWeight: '700',
      marginBottom: 6,
      lineHeight: sf(21),
    },
    titleLast: {
      marginBottom: 0,
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
    footerGrouped: {
      marginTop: 2,
      paddingTop: 4,
      borderTopWidth: 0,
    },
  });
}
