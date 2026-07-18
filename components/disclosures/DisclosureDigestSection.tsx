/**
 * 공시 탭 상단 - 뉴스 주요 이슈(DigestPager)와 동일한 자유 가로 스크롤 스트립
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { DigestRefreshTail } from '@/components/feed/DigestRefreshTail';
import { makeDigestStripCardStyles } from '@/components/feed/digestStripCardStyles';
import { WebHorizontalScrollStrip, type WebHorizontalScrollStripHandle } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import {
  DIGEST_CARD_GAP,
  DISCLOSURE_DIGEST_TAG_MAX_PAIR,
  DISCLOSURE_DIGEST_TAG_MAX_SINGLE,
  digestStripCardMinHeight,
  digestStripCardWidth,
  digestStripScrollPadding,
} from '@/constants/digestStripLayout';
import { FEED_SUMMARY_PX } from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  disclosureMeaningLabelIdsForForms,
  isImportantDisclosureDigest,
} from '@/domain/disclosures';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { disclosureDigestCreatedIso } from '@/domain/digests/createdAt';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatFeedItemTimeLabel } from '@/utils/date';

export function disclosureDigestSourceSheetRows(
  item: SignalApiDisclosureDigestItem,
  locale: AppLocale,
): DigestSourceSheetRow[] {
  return item.sourceRefs.map((ref) => ({
    key: ref.id,
    title: ref.title || ref.companyName,
    subtitle: [ref.symbol, ref.formType].filter(Boolean).join(' · ') || undefined,
    url: ref.url,
    timeLabel: ref.filedAt ? formatFeedItemTimeLabel(ref.filedAt, locale) : null,
  }));
}

function marketChipLabel(market: string, locale: string): string {
  if (market === 'kr') return locale === 'ko' ? '한국' : locale === 'ja' ? '韓国' : 'Korea';
  return locale === 'ko' ? '미국' : locale === 'ja' ? '米国' : 'US';
}

type DigestCardProps = {
  item: SignalApiDisclosureDigestItem;
  onOpenSources: (item: SignalApiDisclosureDigestItem) => void;
  styles: ReturnType<typeof makeDigestStripCardStyles> & { summaryLine: object; importantChip: object };
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
  const summaryBody = item.summary?.trim() || '';
  const summaryMeta = t('disclosuresDigestSummary', {
    count: String(item.count),
    symbols: String(item.symbols.length),
  });
  const createdLabel = formatFeedItemTimeLabel(disclosureDigestCreatedIso(item), locale as AppLocale);
  const important = isImportantDisclosureDigest(item);
  const meaningIds = disclosureMeaningLabelIdsForForms(
    item.forms,
    item.market,
    pairLayout ? 1 : 2,
  );
  const maxTags = pairLayout ? DISCLOSURE_DIGEST_TAG_MAX_PAIR : DISCLOSURE_DIGEST_TAG_MAX_SINGLE;
  const topicChips = useMemo(() => {
    const chips: { key: string; label: string; important?: boolean }[] = [];
    if (important) {
      chips.push({ key: 'important', label: t('disclosuresImportantBadge'), important: true });
    }
    chips.push({ key: 'market', label: marketChipLabel(item.market, locale) });
    for (const id of meaningIds) {
      chips.push({ key: id, label: t(id) });
    }
    if (!pairLayout) {
      for (const symbol of item.symbols) {
        if (chips.length >= maxTags) break;
        chips.push({ key: `sym-${symbol}`, label: symbol });
      }
    }
    return chips.slice(0, maxTags);
  }, [important, item.market, item.symbols, locale, maxTags, meaningIds, pairLayout, t]);

  const showDetail = Boolean(item.title?.trim() || summaryBody || item.sourceRefs.length > 0);
  const showCountChip = topicChips.length === 0 && item.count > 0;

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        {topicChips.map((chip) => (
          <Text
            key={chip.key}
            style={[styles.topicChip, chip.important && styles.importantChip]}
            numberOfLines={1}>
            {chip.label}
          </Text>
        ))}
        {showCountChip ? (
          <Text style={styles.topicChip} numberOfLines={1}>
            {t('feedDigestCount', { count: String(item.count) })}
          </Text>
        ) : null}
      </View>

      <View style={styles.titleBody}>
        <Text style={styles.title} numberOfLines={summaryBody ? 1 : 2}>
          {item.title}
        </Text>
        {summaryBody ? (
          <Text style={styles.summaryLine} numberOfLines={1}>
            {summaryBody}
          </Text>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footer} numberOfLines={1}>
          {summaryMeta}
          {createdLabel !== '—' ? ` · ${createdLabel}` : ''}
        </Text>
        {showDetail ? (
          <Pressable
            onPress={() => onOpenSources(item)}
            style={({ pressed }) => [styles.detailBtn, pressed && styles.detailBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('feedDigestDetailA11y')}>
            <FontAwesome name="info-circle" size={14} color={theme.green} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

type Props = {
  items: SignalApiDisclosureDigestItem[];
  loading?: boolean;
  /** iPad·wide 웹 등 넓은 화면에서 한 줄에 2장씩 표시 */
  columns?: 1 | 2;
  onRefresh?: () => void;
  refreshing?: boolean;
  onGoToList?: () => void;
  goToListA11y?: string;
};

export function DisclosureDigestSection({
  items,
  loading,
  columns = 1,
  onRefresh,
  refreshing,
  onGoToList,
  goToListA11y,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const pairLayout = columns === 2;
  const stripRef = useRef<WebHorizontalScrollStripHandle>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sourcesItem, setSourcesItem] = useState<SignalApiDisclosureDigestItem | null>(null);
  const cardWidth = digestStripCardWidth(containerWidth, pairLayout, items.length);
  const scrollPadding = digestStripScrollPadding(pairLayout, items.length);
  const stripMinHeight = digestStripCardMinHeight(pairLayout, feedTypo);
  const styles = useMemo(
    () => ({
      ...makeStripStyles(scrollPadding, stripMinHeight),
      ...makeDigestStripCardStyles(theme, scaleFont, feedTypo, {
        pairLayout,
      }),
      ...makeDisclosureCardExtras(theme, scaleFont, feedTypo),
    }),
    [theme, scaleFont, feedTypo, pairLayout, scrollPadding, stripMinHeight],
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
    () => (sourcesItem ? disclosureDigestSourceSheetRows(sourcesItem, locale as AppLocale) : []),
    [locale, sourcesItem],
  );

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <View
      style={styles.container}
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
            goToListA11y={goToListA11y}
          />
        ) : null}
      </WebHorizontalScrollStrip>
      <DigestSourcesSheet
        visible={sourcesItem != null}
        kicker={t('disclosureFlowTitle')}
        digestTitle={sourcesItem?.title ?? ''}
        digestSummary={sourcesItem?.summary?.trim() || undefined}
        entities={sourcesItem?.entities}
        rows={sourceRows}
        onClose={closeSources}
      />
    </View>
  );
}

function makeDisclosureCardExtras(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
) {
  return StyleSheet.create({
    summaryLine: {
      marginTop: 2,
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    importantChip: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
      color: theme.green,
    },
  });
}

function makeStripStyles(
  scrollPadding: ReturnType<typeof digestStripScrollPadding>,
  minHeight: number,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 0,
      minHeight,
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
      alignSelf: 'stretch',
    },
  });
}
