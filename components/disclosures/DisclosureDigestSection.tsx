/**
 * 공시 탭 상단 - 뉴스 주요 이슈(DigestPager)와 동일한 자유 가로 스크롤 스트립
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { DigestRefreshTail } from '@/components/feed/DigestRefreshTail';
import { WebHorizontalScrollStrip, type WebHorizontalScrollStripHandle } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { CONTENT_ACCENT_LINE_WIDTH, homeSectionAccentColor, type HomeAccentSection } from '@/constants/homeSectionAccent';
import {
  DIGEST_CARD_GAP,
  DISCLOSURE_DIGEST_TAG_MAX_PAIR,
  DISCLOSURE_DIGEST_TAG_MAX_SINGLE,
  digestStripCardWidth,
  digestStripScrollPadding,
} from '@/constants/digestStripLayout';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { disclosureDigestCreatedIso } from '@/domain/digests/createdAt';
import { formatFeedItemTimeLabel } from '@/utils/date';

function disclosureSourceRows(item: SignalApiDisclosureDigestItem): DigestSourceSheetRow[] {
  return item.sourceRefs.map((ref) => ({
    key: ref.id,
    title: ref.title || ref.companyName,
    subtitle: [ref.symbol, ref.formType].filter(Boolean).join(' · ') || undefined,
    url: ref.url,
  }));
}

function marketChipLabel(market: string, locale: string): string {
  if (market === 'kr') return locale === 'ko' ? '한국' : locale === 'ja' ? '韓国' : 'Korea';
  return locale === 'ko' ? '미국' : locale === 'ja' ? '米国' : 'US';
}

function buildTopicChips(
  item: SignalApiDisclosureDigestItem,
  locale: string,
  pairLayout: boolean,
): string[] {
  const maxTags = pairLayout ? DISCLOSURE_DIGEST_TAG_MAX_PAIR : DISCLOSURE_DIGEST_TAG_MAX_SINGLE;
  const candidates = [
    marketChipLabel(item.market, locale),
    ...item.symbols,
    ...item.forms,
  ].filter(Boolean);
  return [...new Set(candidates)].slice(0, maxTags);
}

type DigestCardProps = {
  item: SignalApiDisclosureDigestItem;
  onOpenSources: (item: SignalApiDisclosureDigestItem) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  pairLayout?: boolean;
};

const DigestCard = memo(function DigestCard({
  item,
  onOpenSources,
  styles,
  theme,
  pairLayout = false,
}: DigestCardProps) {
  const { t, locale } = useLocale();
  const summaryText = t('disclosuresDigestSummary', {
    count: String(item.count),
    symbols: String(item.symbols.length),
  });
  const createdLabel = formatFeedItemTimeLabel(disclosureDigestCreatedIso(item), locale as AppLocale);
  const topicChips = buildTopicChips(item, locale, pairLayout);
  const showSources = item.sourceRefs.length > 0;

  return (
    <View style={[styles.card, pairLayout && styles.cardPair]}>
      <View style={[styles.accentLine, pairLayout && styles.accentLinePair]} />
      {topicChips.length > 0 ? (
        <View style={[styles.badgeRow, pairLayout && styles.badgeRowPair]}>
          {topicChips.map((chip, index) => (
            <Text key={`${chip}-${index}`} style={styles.topicChip} numberOfLines={1}>
              {chip}
            </Text>
          ))}
        </View>
      ) : (
        <View style={[styles.badgeRow, pairLayout && styles.badgeRowPair]} />
      )}

      <Text style={[styles.title, pairLayout && styles.titlePair]} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.footerRow}>
        <Text style={styles.footer} numberOfLines={1}>
          {summaryText}
          {createdLabel !== '—' ? ` · ${createdLabel}` : ''}
        </Text>
        {showSources ? (
          <Pressable
            onPress={() => onOpenSources(item)}
            style={({ pressed }) => [styles.sourcesBtn, pressed && styles.sourcesBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('feedDigestSourcesButton')}>
            <Text style={styles.sourcesBtnText}>{t('feedDigestSourcesButton')}</Text>
            <FontAwesome name="list-ul" size={10} color={theme.green} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

type Props = {
  items: SignalApiDisclosureDigestItem[];
  loading?: boolean;
  accentColor?: string;
  accentSection?: HomeAccentSection;
  /** iPad·wide 웹 등 넓은 화면에서 한 줄에 2장씩 표시 */
  columns?: 1 | 2;
  onRefresh?: () => void;
  refreshing?: boolean;
  onGoToList?: () => void;
};

export function DisclosureDigestSection({
  items,
  loading,
  accentColor,
  accentSection,
  columns = 1,
  onRefresh,
  refreshing,
  onGoToList,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const pairLayout = columns === 2;
  const stripRef = useRef<WebHorizontalScrollStripHandle>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sourcesItem, setSourcesItem] = useState<SignalApiDisclosureDigestItem | null>(null);
  const cardWidth = digestStripCardWidth(containerWidth, pairLayout, items.length);
  const scrollPadding = digestStripScrollPadding(pairLayout, items.length);
  const resolvedAccent = accentSection ? homeSectionAccentColor(accentSection, theme) : accentColor;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, resolvedAccent, pairLayout, scrollPadding),
    [theme, scaleFont, feedTypo, resolvedAccent, pairLayout, scrollPadding],
  );

  const openSources = useCallback((item: SignalApiDisclosureDigestItem) => {
    setSourcesItem(item);
  }, []);

  const closeSources = useCallback(() => {
    setSourcesItem(null);
  }, []);

  const closeSourcesOnScroll = useCallback(() => {
    setSourcesItem(null);
  }, []);

  const handleGoToList = useCallback(() => {
    stripRef.current?.scrollToStart();
    setSourcesItem(null);
    onGoToList?.();
  }, [onGoToList]);

  const handleRefresh = useCallback(() => {
    stripRef.current?.scrollToStart();
    setSourcesItem(null);
    onRefresh?.();
  }, [onRefresh]);

  const sourceRows = useMemo(
    () => (sourcesItem ? disclosureSourceRows(sourcesItem) : []),
    [sourcesItem],
  );

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <View
      style={[styles.container, pairLayout && styles.containerPair]}
      onLayout={(event) => {
        const next = Math.max(0, Math.round(event.nativeEvent.layout.width));
        setContainerWidth((prev) => (prev === next ? prev : next));
      }}>
      <WebHorizontalScrollStrip
        ref={stripRef}
        onScrollBeginDrag={closeSourcesOnScroll}
        contentContainerStyle={styles.scrollContent}>
        {cardWidth > 0 &&
          items.map((item) => (
            <View key={item.id} style={[styles.cardSlot, { width: cardWidth }]}>
              <DigestCard
                item={item}
                onOpenSources={openSources}
                styles={styles}
                theme={theme}
                pairLayout={pairLayout}
              />
            </View>
          ))}
        {onRefresh || onGoToList ? (
          <DigestRefreshTail
            onRefresh={onRefresh ? handleRefresh : undefined}
            refreshing={refreshing}
            onGoToList={onGoToList ? handleGoToList : undefined}
          />
        ) : null}
      </WebHorizontalScrollStrip>
      <DigestSourcesSheet
        visible={sourcesItem != null}
        digestTitle={sourcesItem?.title ?? ''}
        rows={sourceRows}
        onClose={closeSources}
      />
    </View>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  accentColor: string | undefined,
  pairLayout: boolean,
  scrollPadding: ReturnType<typeof digestStripScrollPadding>,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 0,
      minHeight: 118,
    },
    containerPair: {
      minHeight: 104,
    },
    scrollContent: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: DIGEST_CARD_GAP,
      paddingHorizontal: scrollPadding.paddingHorizontal,
      paddingRight: scrollPadding.paddingRight,
    },
    cardSlot: {
      flexShrink: 0,
    },
    card: {
      flex: 1,
      minHeight: 118,
      paddingLeft: 18,
      paddingRight: ft.pad(13),
      paddingVertical: ft.pad(11),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      gap: 6,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    cardPair: {
      minHeight: 104,
      paddingLeft: 14,
      paddingRight: ft.pad(11),
      paddingVertical: ft.pad(9),
      borderRadius: 12,
      gap: 5,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    accentLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: CONTENT_ACCENT_LINE_WIDTH,
      backgroundColor: accentColor || theme.warning,
    },
    accentLinePair: {
      opacity: 0.45,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 5,
      alignItems: 'center',
      height: 22,
      overflow: 'hidden',
    },
    badgeRowPair: {
      height: 20,
    },
    topicChip: {
      overflow: 'hidden',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: ft.ff(10),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
    },
    title: {
      fontSize: ft.ff(15),
      lineHeight: ft.ff(21),
      minHeight: ft.ff(21) * 2,
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    titlePair: {
      fontSize: ft.ff(14),
      lineHeight: ft.ff(19),
      minHeight: ft.ff(19) * 2,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    footer: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      flex: 1,
      minWidth: 0,
    },
    sourcesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      flexShrink: 0,
    },
    sourcesBtnPressed: {
      opacity: 0.88,
    },
    sourcesBtnText: {
      fontSize: ft.ff(10),
      lineHeight: sf(14),
      fontWeight: '800',
      color: theme.green,
    },
  });
}
