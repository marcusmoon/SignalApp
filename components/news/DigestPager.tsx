import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { WebHorizontalScrollStrip } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsDigestItem } from '@/domain/news';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

const CARD_GAP = 10;
/** wide 스트립 가로 inset (compact는 topFixed padding과 맞춤) */
const CARD_EDGE_PAD = 12;
/** iPhone 1열: 다음 카드가 보이는 peek 폭 */
const SINGLE_NEXT_CARD_PEEK = 36;
/** wide: 다음 카드가 살짝 보이도록 */
const PAIR_CARD_WIDTH_RATIO = 0.48;

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

function hasDigestSources(digest: NewsDigestItem): boolean {
  return digest.sourceRefs.length > 0 || digest.sources.length > 0;
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
  const showSources = hasDigestSources(digest);

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
        {showSources ? (
          <Pressable
            onPress={() => onOpenSources(digest)}
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
  batches: NewsDigestItem[];
  /** iPad·wide 웹 등 넓은 화면에서 한 페이지에 2장씩 표시 */
  columns?: 1 | 2;
};

function digestCardWidth(containerWidth: number, pairLayout: boolean, itemCount: number): number {
  if (containerWidth <= 0) return 0;
  if (pairLayout) {
    return Math.floor((containerWidth - CARD_GAP) * PAIR_CARD_WIDTH_RATIO);
  }
  if (itemCount <= 1) return containerWidth;
  return Math.max(0, containerWidth - SINGLE_NEXT_CARD_PEEK);
}

export function DigestPager({ batches, columns = 1 }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const pairLayout = columns === 2;
  const [containerWidth, setContainerWidth] = useState(0);
  const [sourcesDigest, setSourcesDigest] = useState<NewsDigestItem | null>(null);
  const cardWidth = digestCardWidth(containerWidth, pairLayout, batches.length);
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, pairLayout, batches.length),
    [theme, scaleFont, feedTypo, pairLayout, batches.length],
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
      </WebHorizontalScrollStrip>
      <DigestSourcesSheet
        visible={sourcesDigest != null}
        digestTitle={sourcesDigest?.title ?? ''}
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
  itemCount: number,
) {
  const showSinglePeek = !pairLayout && itemCount > 1;
  return StyleSheet.create({
    container: {
      marginBottom: 0,
    },
    scrollContent: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: CARD_GAP,
      paddingHorizontal: pairLayout ? CARD_EDGE_PAD : 0,
      paddingRight: pairLayout ? CARD_EDGE_PAD + 4 : showSinglePeek ? SINGLE_NEXT_CARD_PEEK : 0,
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
