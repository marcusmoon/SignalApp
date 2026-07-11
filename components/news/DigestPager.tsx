import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { DigestRefreshTail } from '@/components/feed/DigestRefreshTail';
import { makeDigestStripCardStyles } from '@/components/feed/digestStripCardStyles';
import { WebHorizontalScrollStrip, type WebHorizontalScrollStripHandle } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import {
  DIGEST_CARD_GAP,
  DIGEST_STRIP_CARD_MIN_HEIGHT,
  DIGEST_STRIP_CARD_MIN_HEIGHT_PAIR,
  digestStripCardWidth,
  digestStripScrollPadding,
} from '@/constants/digestStripLayout';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsDigestItem } from '@/domain/news';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

function digestSourceRows(digest: NewsDigestItem): DigestSourceSheetRow[] {
  if (digest.sourceRefs.length > 0) {
    return digest.sourceRefs.map((ref, index) => ({
      key: ref.id || `${digest.id}-ref-${index}`,
      title: ref.title || ref.sourceName || ref.url || '',
      subtitle: ref.sourceName || undefined,
      url: ref.url,
    }));
  }
  return digest.sources.map((src, index) => ({
    key: `${digest.id}-src-${index}`,
    title: src,
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
  const summaryText = t('feedDigestSummary', {
    count: String(digest.count),
    sources: String(digest.sources.length),
  });
  const createdLabel = formatFeedItemTimeLabel(newsDigestCreatedIso(digest), locale as AppLocale);
  const showDetail = hasDigestDetail(digest);
  const topicChips = digest.topics.slice(0, pairLayout ? 2 : 3);
  const showCountChip = !digest.aiGenerated && topicChips.length === 0 && digest.count > 0;

  return (
    <View style={styles.card}>
      <View style={styles.accentLine} />
      <View style={styles.badgeRow}>
        {digest.aiGenerated ? (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>✦ AI</Text>
          </View>
        ) : null}
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
        <Text style={styles.footer} numberOfLines={1}>
          {summaryText}
          {createdLabel !== '—' ? ` · ${createdLabel}` : ''}
        </Text>
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
};

export function DigestPager({ batches, columns = 1, onRefresh, refreshing, onGoToList }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const pairLayout = columns === 2;
  const stripRef = useRef<WebHorizontalScrollStripHandle>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sourcesDigest, setSourcesDigest] = useState<NewsDigestItem | null>(null);
  const cardWidth = digestStripCardWidth(containerWidth, pairLayout, batches.length);
  const scrollPadding = digestStripScrollPadding(pairLayout, batches.length);
  const styles = useMemo(
    () => ({
      ...makeStripStyles(scrollPadding),
      ...makeDigestStripCardStyles(theme, scaleFont, feedTypo, {
        pairLayout,
        accentColor: theme.green,
      }),
    }),
    [theme, scaleFont, feedTypo, pairLayout, scrollPadding],
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
    () => (sourcesDigest ? digestSourceRows(sourcesDigest) : []),
    [sourcesDigest],
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
          />
        ) : null}
      </WebHorizontalScrollStrip>
      <DigestSourcesSheet
        visible={sourcesDigest != null}
        digestTitle={sourcesDigest?.title ?? ''}
        digestSummary={sourcesDigest?.summary?.trim() || undefined}
        rows={sourceRows}
        onClose={closeSources}
      />
    </View>
  );
}

function makeStripStyles(scrollPadding: ReturnType<typeof digestStripScrollPadding>) {
  return StyleSheet.create({
    container: {
      marginBottom: 0,
      minHeight: DIGEST_STRIP_CARD_MIN_HEIGHT,
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
