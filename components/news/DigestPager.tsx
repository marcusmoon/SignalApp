import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { DigestRefreshTail } from '@/components/feed/DigestRefreshTail';
import { WebHorizontalScrollStrip, type WebHorizontalScrollStripHandle } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import {
  DIGEST_CARD_GAP,
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
  styles: ReturnType<typeof makeStyles>;
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

  return (
    <View style={[styles.card, pairLayout && styles.cardPair]}>
      <View style={[styles.accentLine, pairLayout && styles.accentLinePair]} />
      {digest.aiGenerated || digest.topics.length > 0 ? (
        <View style={styles.badgeRow}>
          {digest.aiGenerated ? (
            <View style={[styles.aiBadge, pairLayout && styles.aiBadgePair]}>
              <Text style={styles.aiBadgeText}>✦ AI</Text>
            </View>
          ) : null}
          {digest.topics.slice(0, pairLayout ? 2 : 4).map((topic) => (
            <Text key={topic} style={styles.topicChip} numberOfLines={1}>
              {topic}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={[styles.title, pairLayout && styles.titlePair]} numberOfLines={2}>
        {digest.title}
      </Text>

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
            <FontAwesome name="info-circle" size={15} color={theme.green} />
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
    () => makeStyles(theme, scaleFont, feedTypo, pairLayout, scrollPadding),
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

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  pairLayout: boolean,
  scrollPadding: ReturnType<typeof digestStripScrollPadding>,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 0,
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
      backgroundColor: theme.green,
    },
    accentLinePair: {
      opacity: 0.45,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      alignItems: 'center',
    },
    aiBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.accentBlue,
      borderWidth: 1,
      borderColor: theme.accentBlue,
    },
    aiBadgePair: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    aiBadgeText: {
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '900',
      color: '#FFFFFF',
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
      minHeight: undefined,
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
    detailBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 15,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      flexShrink: 0,
    },
    detailBtnPressed: {
      opacity: 0.88,
    },
  });
}
