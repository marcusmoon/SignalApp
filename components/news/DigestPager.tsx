import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { DigestRefreshTail } from '@/components/feed/DigestRefreshTail';
import { AiBadge } from '@/components/signal/AiBadge';
import { makeDigestStripCardStyles } from '@/components/feed/digestStripCardStyles';
import { WebHorizontalScrollStrip, type WebHorizontalScrollStripHandle } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { digestSourceIconEntries, SourceIconStack, type SourceIconEntry } from '@/components/signal/SourceIconStack';
import {
  DIGEST_CARD_GAP,
  digestStripCardMinHeight,
  digestStripCardWidth,
  digestStripScrollPadding,
} from '@/constants/digestStripLayout';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsDigestItem } from '@/domain/news';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import { isDigestFresh } from '@/domain/digests/freshness';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

function digestSourceIconEntry(
  sourceName: string | null | undefined,
  url?: string | null,
): SourceIconEntry[] {
  const name = String(sourceName || '').trim();
  if (!name) return [];
  return [{ sourceName: name, url }];
}

export function newsDigestSourceSheetRows(
  digest: Pick<NewsDigestItem, 'id' | 'sourceRefs' | 'sources'>,
  locale: AppLocale,
): DigestSourceSheetRow[] {
  if (digest.sourceRefs.length > 0) {
    return digest.sourceRefs.map((ref, index) => ({
      key: ref.id || `${digest.id}-ref-${index}`,
      title: ref.title || ref.sourceName || ref.url || '',
      subtitle: ref.sourceName || undefined,
      url: ref.url,
      timeLabel: ref.publishedAt ? formatFeedItemTimeLabel(ref.publishedAt, locale) : null,
      sourceEntries: digestSourceIconEntry(ref.sourceName, ref.url),
    }));
  }
  return digest.sources.map((src, index) => ({
    key: `${digest.id}-src-${index}`,
    title: src,
    sourceEntries: digestSourceIconEntry(src),
  }));
}

function hasDigestDetail(digest: NewsDigestItem): boolean {
  return Boolean(digest.title?.trim() || digest.summary?.trim() || digest.sourceRefs.length || digest.sources.length);
}

type DigestCardProps = {
  digest: NewsDigestItem;
  onOpenSources: (digest: NewsDigestItem) => void;
  styles: ReturnType<typeof makeDigestStripCardStyles>;
  theme: AppTheme;
  pairLayout?: boolean;
};

const DigestCard = memo(function DigestCard({
  digest,
  onOpenSources,
  styles,
  theme,
  pairLayout = false,
}: DigestCardProps) {
  const { t, locale } = useLocale();
  const sourceEntries = digestSourceIconEntries(digest.sourceRefs, digest.sources);
  const summaryText = t('feedDigestSummary', {
    count: String(digest.count),
    sources: String(digest.sources.length),
  });
  const countText = t('feedDigestCount', { count: String(digest.count) });
  const createdIso = newsDigestCreatedIso(digest);
  const createdLabel = formatFeedItemTimeLabel(createdIso, locale as AppLocale);
  const isFresh = isDigestFresh(createdIso);
  const footerMeta = [
    sourceEntries.length > 0 ? countText : summaryText,
    isFresh ? t('digestFreshBadge') : null,
    createdLabel !== '—' ? createdLabel : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const showDetail = hasDigestDetail(digest);
  const topicChips = digest.topics.slice(0, pairLayout ? 2 : 3);
  const showCountChip = !digest.aiGenerated && topicChips.length === 0 && digest.count > 0;
  const iconSize = pairLayout ? 16 : 18;
  const iconMax = pairLayout ? 3 : 4;

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        {digest.aiGenerated ? <AiBadge /> : null}
        {topicChips.map((topic) => (
          <Text key={topic} style={styles.topicChip} numberOfLines={1}>
            {topic}
          </Text>
        ))}
        {showCountChip ? (
          <Text style={styles.topicChip} numberOfLines={1}>
            {t('feedDigestCount', { count: String(digest.count) })}
          </Text>
        ) : null}
      </View>

      <View style={styles.titleBody}>
        <Text style={styles.title} numberOfLines={2}>
          {digest.title}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerLead}>
          {sourceEntries.length > 0 ? (
            <SourceIconStack sources={sourceEntries} size={iconSize} maxVisible={iconMax} />
          ) : null}
          <Text
            style={[styles.footer, isFresh && styles.footerFresh]}
            numberOfLines={1}
            accessibilityLabel={isFresh ? t('digestFreshBadgeA11y') : undefined}>
            {footerMeta}
          </Text>
        </View>
        {showDetail ? (
          <Pressable
            onPress={() => onOpenSources(digest)}
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
  batches: NewsDigestItem[];
  /** iPad·wide 웹 등 넓은 화면에서 한 페이지에 2장씩 표시 */
  columns?: 1 | 2;
  onRefresh?: () => void;
  refreshing?: boolean;
  onGoToList?: () => void;
  goToListA11y?: string;
};

export function DigestPager({ batches, columns = 1, onRefresh, refreshing, onGoToList, goToListA11y }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const pairLayout = columns === 2;
  const stripRef = useRef<WebHorizontalScrollStripHandle>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sourcesDigest, setSourcesDigest] = useState<NewsDigestItem | null>(null);
  const cardWidth = digestStripCardWidth(containerWidth, pairLayout, batches.length);
  const scrollPadding = digestStripScrollPadding(pairLayout, batches.length);
  const stripMinHeight = digestStripCardMinHeight(pairLayout, feedTypo);
  const styles = useMemo(
    () => ({
      ...makeStripStyles(scrollPadding, stripMinHeight),
      ...makeDigestStripCardStyles(theme, scaleFont, feedTypo, {
        pairLayout,
      }),
    }),
    [theme, scaleFont, feedTypo, pairLayout, scrollPadding, stripMinHeight],
  );

  const openSources = useCallback((digest: NewsDigestItem) => {
    setSourcesDigest(digest);
  }, []);

  const closeSources = useCallback(() => {
    setSourcesDigest(null);
  }, []);

  const closeSourcesOnScroll = useCallback(() => {
    setSourcesDigest(null);
  }, []);

  const handleGoToList = useCallback(() => {
    stripRef.current?.scrollToStart();
    setSourcesDigest(null);
    onGoToList?.();
  }, [onGoToList]);

  const handleRefresh = useCallback(() => {
    stripRef.current?.scrollToStart();
    setSourcesDigest(null);
    onRefresh?.();
  }, [onRefresh]);

  const sourceRows = useMemo(
    () => (sourcesDigest ? newsDigestSourceSheetRows(sourcesDigest, locale as AppLocale) : []),
    [locale, sourcesDigest],
  );

  if (batches.length === 0) return null;

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
          batches.map((digest) => (
            <View key={digest.id} style={[styles.cardSlot, { width: cardWidth }]}>
              <DigestCard
                digest={digest}
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
        visible={sourcesDigest != null}
        kicker={t('newsIssuesTitle')}
        digestTitle={sourcesDigest?.title ?? ''}
        digestSummary={sourcesDigest?.summary?.trim() || undefined}
        rows={sourceRows}
        onClose={closeSources}
      />
    </View>
  );
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
