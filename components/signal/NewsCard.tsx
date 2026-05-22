import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
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
  /** 관심뉴스처럼 컨텍스트가 이미 명확한 목록에서는 메타를 한 줄로 압축 */
  compactMeta?: boolean;
  /** 미지정 시 URL이 있으면 원문 브라우저 오픈 (추후 상세 화면으로 교체 예정) */
  onPress?: () => void;
};

export function NewsCard({
  item,
  maxHashtagsToShow = 4,
  onTagPress,
  layout = 'card',
  compactMeta = false,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

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
  const rowPressEnabled = Boolean(onPress) || canOpenArticle;

  const openArticle = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (!canOpenArticle) return;
    void WebBrowser.openBrowserAsync(articleUrl);
  }, [articleUrl, canOpenArticle, onPress]);

  const rowA11yLabel = [item.titleKo, sourceName, item.timeLabel].filter(Boolean).join(', ');

  const sourceContent = (
    <View style={styles.sourcePill}>
      <Text style={styles.sourceName} numberOfLines={1}>
        {sourceName}
      </Text>
    </View>
  );

  const renderSourceInMeta = () => <View style={styles.sourceRowCompact}>{sourceContent}</View>;

  const renderSourceBelowMeta = () => <View style={styles.sourceRow}>{sourceContent}</View>;

  return (
    <View
      style={[
        styles.card,
        grouped && styles.cardGrouped,
        isFlash && (grouped ? styles.cardFlashGrouped : styles.cardFlash),
      ]}>
      {isFlash && grouped ? <View pointerEvents="none" style={styles.flashSideLine} /> : null}
      <Pressable
        onPress={openArticle}
        disabled={!rowPressEnabled}
        style={({ pressed }) => [styles.rowPress, rowPressEnabled && pressed && styles.rowPressPressed]}
        accessibilityRole={rowPressEnabled ? 'button' : undefined}
        accessibilityLabel={rowPressEnabled ? rowA11yLabel : undefined}
        accessibilityHint={rowPressEnabled ? t('newsReadMore') : undefined}>
        {isFlash ? (
          <View style={styles.flashBadgeWrap} accessibilityLabel={t('newsFlashBadge')}>
            <View style={styles.flashBadge}>
              <Text style={styles.flashBadgeText}>{t('newsFlashBadge')}</Text>
            </View>
          </View>
        ) : null}
        {compactMeta ? (
          <View style={styles.compactMetaRow}>
            {canOpenSymbol ? (
              <Pressable
                onPress={() => router.push(`/symbol/${symbol}`)}
                hitSlop={8}
                style={styles.compactTickerWrap}>
                <Text style={styles.compactTicker} numberOfLines={1}>
                  {headerLabel}
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.compactMetaText} numberOfLines={1}>
              {[canOpenSymbol ? sourceName : headerLabel, item.timeLabel].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.metaRow, showSourceInHeader && styles.metaRowWithSource]}>
              {canOpenSymbol ? (
                <Pressable
                  onPress={() => router.push(`/symbol/${symbol}`)}
                  hitSlop={8}
                  style={styles.metaLead}>
                  <Text style={styles.ticker} numberOfLines={1}>
                    {headerLabel}
                  </Text>
                </Pressable>
              ) : (
                renderSourceInMeta()
              )}
              <View style={styles.timePill}>
                <Text style={styles.time}>{item.timeLabel}</Text>
              </View>
            </View>
            {canOpenSymbol ? renderSourceBelowMeta() : null}
          </>
        )}
        <Text style={[styles.title, tags.length === 0 && styles.titleLast]}>{item.titleKo}</Text>
      </Pressable>
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

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: ft.pad(14),
      paddingTop: ft.pad(14),
      paddingBottom: ft.pad(6),
      marginBottom: 10,
    },
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      marginBottom: 0,
      paddingHorizontal: ft.pad(16),
      paddingTop: ft.pad(12),
      paddingBottom: ft.pad(4),
      position: 'relative',
    },
    cardFlash: {
      borderColor: 'rgba(255, 90, 90, 0.45)',
      borderLeftWidth: 3,
      borderLeftColor: '#FF5A5A',
      backgroundColor: 'rgba(255, 90, 90, 0.06)',
    },
    cardFlashGrouped: {
      backgroundColor: 'rgba(255, 90, 90, 0.045)',
    },
    flashSideLine: {
      position: 'absolute',
      left: 0,
      top: ft.pad(10),
      bottom: ft.pad(10),
      width: 3,
      borderRadius: 999,
      backgroundColor: '#FF5A5A',
    },
    rowPress: {
      alignSelf: 'stretch',
    },
    rowPressPressed: {
      opacity: 0.92,
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
      fontSize: ft.ff(11),
      fontWeight: ft.emphasisWeight,
      color: '#FF9A9A',
      letterSpacing: 0.8,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: ft.pad(8),
      marginBottom: ft.pad(6),
    },
    metaRowWithSource: {
      marginBottom: ft.pad(10),
    },
    metaLead: {
      flex: 1,
      minWidth: 0,
    },
    ticker: {
      flexShrink: 1,
      color: theme.green,
      fontSize: ft.ff(13),
      fontWeight: ft.emphasisWeight,
      letterSpacing: 0.5,
    },
    timePill: {
      flexShrink: 0,
      paddingHorizontal: ft.pad(8),
      paddingVertical: ft.pad(3),
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    time: {
      color: theme.textMuted,
      fontSize: ft.ff(10),
      fontWeight: ft.metaWeight,
    },
    compactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ft.pad(6),
      marginBottom: ft.pad(7),
      minWidth: 0,
    },
    compactTickerWrap: {
      flexShrink: 0,
      maxWidth: '28%',
    },
    compactTicker: {
      color: theme.green,
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.emphasisWeight,
      letterSpacing: 0.2,
    },
    compactMetaText: {
      flex: 1,
      minWidth: 0,
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(16),
      fontWeight: ft.metaWeight,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: ft.pad(6),
      marginBottom: ft.pad(10),
    },
    sourceRowCompact: {
      flexShrink: 1,
      minWidth: 0,
      marginBottom: 0,
      alignSelf: 'center',
    },
    sourcePill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '100%',
      paddingHorizontal: ft.pad(10),
      paddingVertical: ft.pad(4),
      borderRadius: 999,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    sourceName: {
      flexShrink: 1,
      fontSize: ft.ff(12),
      fontWeight: ft.bodyWeight,
      color: theme.text,
      maxWidth: '100%',
    },
    title: {
      color: theme.text,
      fontSize: ft.ff(15),
      fontWeight: ft.titleWeight,
      marginBottom: ft.pad(6),
      lineHeight: ft.ff(21),
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
      fontSize: ft.ff(10),
      lineHeight: ft.ff(14),
      fontWeight: ft.metaWeight,
      letterSpacing: 0.1,
      color: '#9EC9FF',
      textAlignVertical: Platform.OS === 'android' ? 'center' : undefined,
    },
    footer: {
      marginTop: ft.pad(6),
      paddingTop: ft.pad(8),
      paddingBottom: ft.pad(2),
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
