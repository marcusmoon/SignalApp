import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import { newsSourceAccent } from '@/constants/newsSourceAccent';
import type { AppTheme } from '@/constants/theme';
import { SourceBadge } from '@/components/signal/SourceBadge';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatNewsTimelineTimeLabel } from '@/utils/date';

type Props = {
  item: NewsItem;
  /** 0이면 태그 행 숨김 */
  maxHashtagsToShow?: number;
  onTagPress?: (label: string) => void;
  /** `grouped`: 홈 관련 근거처럼 한 카드 안 행 구분(개별 테두리 없음) */
  layout?: 'card' | 'grouped';
  /** 속보 피드형 좌측 타임라인 레일 */
  timeline?: boolean;
  timelineLast?: boolean;
  /** 관심뉴스처럼 컨텍스트가 이미 명확한 목록에서는 메타를 한 줄로 압축 */
  compactMeta?: boolean;
  /** 글로벌·크립토 등에서 메타 행 제목 토글 아이콘 노출 */
  titleToggle?: boolean;
  /** 목록 전체 제목 표시 모드(지정 시 카드별 토글 숨김) */
  titleShowAlternate?: boolean;
  /** 미지정 시 URL이 있으면 원문 브라우저 오픈 (추후 상세 화면으로 교체 예정) */
  onPress?: () => void;
};

export function NewsCard({
  item,
  maxHashtagsToShow = 4,
  onTagPress,
  layout = 'card',
  timeline = false,
  timelineLast = true,
  compactMeta = false,
  titleToggle = false,
  titleShowAlternate,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const router = useRouter();
  const listTitleMode = titleShowAlternate !== undefined;
  const [localShowAlternate, setLocalShowAlternate] = useState(false);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const sourceName = item.source?.trim() || '—';
  const sourceAccent = useMemo(() => newsSourceAccent(sourceName, theme), [sourceName, theme]);
  const isFlash = Boolean(item.isFlash);
  const symbol = item.ticker?.trim().toUpperCase() ?? '';
  const showSourceInHeader =
    symbol.length === 0 || symbol === 'GLOBAL' || symbol === '—';
  const canOpenSymbol = !showSourceInHeader;
  const headerLabel = showSourceInHeader ? sourceName : item.ticker;

  const alternateTitle = item.alternateTitle?.trim() ?? '';
  const hasTitleToggle = titleToggle && alternateTitle.length > 0;
  const showAlternate = listTitleMode ? Boolean(titleShowAlternate) : localShowAlternate;
  const showingAlternate = hasTitleToggle && showAlternate;
  const displayTitle = showingAlternate ? alternateTitle : item.titleKo;
  const alternateIsTranslation = locale === 'en';
  const showPerItemToggle = hasTitleToggle && !listTitleMode;

  useEffect(() => {
    if (listTitleMode) return;
    setLocalShowAlternate(false);
  }, [item.id, listTitleMode]);

  const tags =
    maxHashtagsToShow > 0
      ? (item.hashtags || [])
          .slice()
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
          .slice(0, maxHashtagsToShow)
      : [];

  const grouped = layout === 'grouped';
  const timelineLabel = useMemo(
    () => formatNewsTimelineTimeLabel(item.publishedAt, locale),
    [item.publishedAt, locale],
  );
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

  const rowA11yLabel = [displayTitle, sourceName, item.timeLabel].filter(Boolean).join(', ');

  const titleToggleA11y = showingAlternate
    ? t('newsTitleShowLocalized')
    : alternateIsTranslation
      ? t('newsTitleShowTranslation')
      : t('newsTitleShowOriginal');

  const sourceContent = <SourceBadge label={sourceName} accent={sourceAccent} />;

  const flashBadge = isFlash ? (
    <View style={styles.sourcePill} accessibilityLabel={t('newsFlashBadge')}>
      <Text style={styles.sourceName} numberOfLines={1}>
        {t('newsFlashBadge')}
      </Text>
    </View>
  ) : null;

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

  const renderSourceInMeta = () => (
    <View style={styles.sourceRowCompact}>
      {flashBadge}
      {titleToggleBtn}
      {sourceContent}
    </View>
  );

  const renderSourceBelowMeta = () => (
    <View style={styles.sourceRow}>
      {flashBadge}
      {titleToggleBtn}
      {sourceContent}
    </View>
  );

  const titleBlock = (
    <Text style={[styles.title, tags.length === 0 && styles.titleLast]}>{displayTitle}</Text>
  );

  const metaBlock = timeline ? (
    <View style={styles.timelineMetaRow}>
      {flashBadge}
      {titleToggleBtn}
      {canOpenSymbol ? (
        <Pressable onPress={() => router.push(`/symbol/${symbol}`)} hitSlop={8} style={styles.compactTickerWrap}>
          <View style={styles.tickerLead}>
            <SymbolLogo symbol={symbol} size={18} />
            <Text style={styles.compactTicker} numberOfLines={1}>
              {headerLabel}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {sourceContent}
    </View>
  ) : compactMeta ? (
    <View style={styles.compactMetaRow}>
      {flashBadge}
      {titleToggleBtn}
      {canOpenSymbol ? (
        <Pressable
          onPress={() => router.push(`/symbol/${symbol}`)}
          hitSlop={8}
          style={styles.compactTickerWrap}>
          <View style={styles.tickerLead}>
            <SymbolLogo symbol={symbol} size={18} />
            <Text style={styles.compactTicker} numberOfLines={1}>
              {headerLabel}
            </Text>
          </View>
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
            <View style={styles.tickerLead}>
              <SymbolLogo symbol={symbol} size={20} />
              <Text style={styles.ticker} numberOfLines={1}>
                {headerLabel}
              </Text>
            </View>
          </Pressable>
        ) : (
          renderSourceInMeta()
        )}
        <View style={styles.metaTrail}>
          {canOpenSymbol ? titleToggleBtn : null}
          <View style={styles.timePill}>
            <Text style={styles.time}>{item.timeLabel}</Text>
          </View>
        </View>
      </View>
      {canOpenSymbol ? renderSourceBelowMeta() : null}
    </>
  );

  const tagsBlock =
    tags.length > 0 ? (
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
    ) : null;

  return (
    <View style={[styles.card, grouped && styles.cardGrouped, timeline && styles.cardTimeline]}>
      {timeline ? (
        <View style={styles.timelineRow}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineNode, isFlash && styles.timelineNodeFlash]}>
              <FontAwesome
                name={isFlash ? 'bolt' : 'circle'}
                size={isFlash ? 10 : 6}
                color={isFlash ? theme.accentOrange : theme.textDim}
              />
            </View>
            {!timelineLast ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.timelineBody}>
            <Pressable
              onPress={openArticle}
              disabled={!rowPressEnabled}
              style={({ pressed }) => [styles.rowPress, rowPressEnabled && pressed && styles.rowPressPressed]}
              accessibilityRole={rowPressEnabled ? 'button' : undefined}
              accessibilityLabel={rowPressEnabled ? rowA11yLabel : undefined}
              accessibilityHint={rowPressEnabled ? t('newsReadMore') : undefined}>
              <Text style={styles.timelineTime}>{timelineLabel}</Text>
              {metaBlock}
              {titleBlock}
            </Pressable>
            {tagsBlock}
          </View>
        </View>
      ) : (
        <>
          <Pressable
            onPress={openArticle}
            disabled={!rowPressEnabled}
            style={({ pressed }) => [styles.rowPress, rowPressEnabled && pressed && styles.rowPressPressed]}
            accessibilityRole={rowPressEnabled ? 'button' : undefined}
            accessibilityLabel={rowPressEnabled ? rowA11yLabel : undefined}
            accessibilityHint={rowPressEnabled ? t('newsReadMore') : undefined}>
            {metaBlock}
            {titleBlock}
          </Pressable>
          {tagsBlock}
        </>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: ft.pad(14),
      paddingTop: ft.pad(14),
      paddingBottom: ft.pad(6),
      marginBottom: 14,
    },
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      marginBottom: 0,
      paddingHorizontal: ft.pad(16),
      paddingTop: ft.pad(16),
      paddingBottom: ft.pad(8),
      position: 'relative',
    },
    cardTimeline: {
      paddingTop: ft.pad(12),
      paddingBottom: ft.pad(10),
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    timelineRail: {
      width: 18,
      alignItems: 'center',
      flexShrink: 0,
    },
    timelineNode: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    timelineNodeFlash: {
      backgroundColor: theme.warningDim,
      borderColor: theme.accentOrange,
    },
    timelineLine: {
      width: 2,
      flexGrow: 1,
      marginTop: 4,
      marginBottom: -4,
      minHeight: 28,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    timelineBody: {
      flex: 1,
      minWidth: 0,
    },
    timelineTime: {
      fontSize: ft.ff(11),
      lineHeight: ft.ff(16),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      marginBottom: ft.pad(6),
    },
    timelineMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: ft.pad(6),
      marginBottom: ft.pad(8),
      minWidth: 0,
    },
    rowPress: {
      alignSelf: 'stretch',
    },
    rowPressPressed: {
      opacity: 0.92,
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
    tickerLead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      flexShrink: 1,
    },
    metaTrail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ft.pad(6),
      flexShrink: 0,
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
    titleToggleBtn: {
      flexShrink: 0,
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
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: ft.pad(6),
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
      lineHeight: ft.ff(22),
    },
    titleLast: {
      marginBottom: 0,
    },
    footerTagsCol: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
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
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 0,
    },
  });
}
