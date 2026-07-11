import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { WebHorizontalScrollStrip } from '@/components/layout/WebHorizontalScrollStrip';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsDigestItem } from '@/domain/news';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

const TAP_MOVE_THRESHOLD = 8;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND_LAYOUT = LayoutAnimation.create(180, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

const CARD_GAP = 10;
const CARD_EDGE_PAD = 12;
/** wide: 다음 카드가 살짝 보이도록 (SaveTicker 스타일) */
const PAIR_CARD_WIDTH_RATIO = 0.48;
const SINGLE_CARD_WIDTH_RATIO = 0.88;

type DigestCardProps = {
  digest: NewsDigestItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  pairLayout?: boolean;
};

const DigestCard = memo(function DigestCard({
  digest,
  isExpanded,
  onToggle,
  styles,
  theme,
  pairLayout = false,
}: DigestCardProps) {
  const { t, locale } = useLocale();
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const summaryText = t('feedDigestSummary', {
    count: String(digest.count),
    sources: String(digest.sources.length),
  });
  const createdLabel = formatFeedItemTimeLabel(newsDigestCreatedIso(digest), locale as AppLocale);
  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    pressStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  }, []);
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const start = pressStartRef.current;
      pressStartRef.current = null;
      if (start) {
        const dx = Math.abs(event.nativeEvent.pageX - start.x);
        const dy = Math.abs(event.nativeEvent.pageY - start.y);
        if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) return;
      }
      onToggle(digest.id);
    },
    [digest.id, onToggle],
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      style={({ pressed }) => [
        styles.card,
        pairLayout && styles.cardPair,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={digest.title}
      accessibilityState={{ expanded: isExpanded }}
    >
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

      {isExpanded && (digest.sourceRefs.length > 0 || digest.sources.length > 0) ? (
        <View style={styles.sourceList}>
          {digest.sourceRefs.length > 0
            ? digest.sourceRefs.slice(0, 5).map((ref, i) => {
                const refUrl = ref.url || undefined;
                return (
                <Pressable
                  key={i}
                  onPress={
                    refUrl
                      ? (e) => {
                          e.stopPropagation?.();
                          void Linking.openURL(refUrl).catch(() => null);
                        }
                      : undefined
                  }
                  style={({ pressed }) => [styles.sourceRow, pressed && refUrl && styles.sourceRowPressed]}
                  accessibilityRole={refUrl ? 'link' : 'text'}
                >
                  <View style={styles.sourceTextCol}>
                    <Text
                      style={[styles.sourceTitle, refUrl && styles.sourceTitleLink]}
                      numberOfLines={2}
                    >
                      {ref.title || ref.sourceName || refUrl || ''}
                    </Text>
                    {ref.sourceName ? (
                      <Text style={styles.sourceName} numberOfLines={1}>
                        {ref.sourceName}
                      </Text>
                    ) : null}
                  </View>
                  {refUrl ? (
                    <FontAwesome name="external-link" size={10} color={theme.accentBlue} />
                  ) : null}
                </Pressable>
                );
              })
            : digest.sources.slice(0, 5).map((src, i) => (
                <View key={i} style={styles.sourceRow}>
                  <Text style={styles.sourceName} numberOfLines={1}>
                    {src}
                  </Text>
                </View>
              ))}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footer}>
          {summaryText}
          {createdLabel !== '—' ? ` · ${createdLabel}` : ''}
        </Text>
        <FontAwesome name={isExpanded ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textDim} />
      </View>
    </Pressable>
  );
});

type Props = {
  batches: NewsDigestItem[];
  /** iPad·wide 웹 등 넓은 화면에서 한 페이지에 2장씩 표시 */
  columns?: 1 | 2;
};

function digestCardWidth(containerWidth: number, pairLayout: boolean): number {
  if (containerWidth <= 0) return 0;
  if (pairLayout) {
    return Math.floor((containerWidth - CARD_GAP) * PAIR_CARD_WIDTH_RATIO);
  }
  return Math.max(0, Math.floor(containerWidth * SINGLE_CARD_WIDTH_RATIO));
}

export function DigestPager({ batches, columns = 1 }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const pairLayout = columns === 2;
  const [containerWidth, setContainerWidth] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardWidth = digestCardWidth(containerWidth, pairLayout);
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, pairLayout),
    [theme, scaleFont, feedTypo, pairLayout],
  );

  const toggleExpand = useCallback((id: string) => {
    if (!pairLayout) {
      LayoutAnimation.configureNext(EXPAND_LAYOUT);
    }
    setExpandedId((prev) => (prev === id ? null : id));
  }, [pairLayout]);

  const collapseOnScroll = useCallback(() => {
    setExpandedId(null);
  }, []);

  if (batches.length === 0) return null;

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const next = Math.max(0, Math.round(event.nativeEvent.layout.width));
        setContainerWidth((prev) => (prev === next ? prev : next));
      }}>
      <WebHorizontalScrollStrip
        onScrollBeginDrag={collapseOnScroll}
        contentContainerStyle={styles.scrollContent}>
        {cardWidth > 0 &&
          batches.map((digest) => (
            <View key={digest.id} style={[styles.cardSlot, { width: cardWidth }]}>
              <DigestCard
                digest={digest}
                isExpanded={expandedId === digest.id}
                onToggle={toggleExpand}
                styles={styles}
                theme={theme}
                pairLayout={pairLayout}
              />
            </View>
          ))}
      </WebHorizontalScrollStrip>
    </View>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  pairLayout: boolean,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    scrollContent: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: CARD_GAP,
      paddingHorizontal: CARD_EDGE_PAD,
      paddingRight: CARD_EDGE_PAD + 4,
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
    cardPressed: {
      opacity: 0.88,
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
    },
    sourceList: {
      gap: 6,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    sourceRowPressed: {
      opacity: 0.7,
    },
    sourceTextCol: {
      flex: 1,
      gap: 1,
    },
    sourceTitle: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(17),
      fontWeight: ft.bodyWeight,
      color: theme.text,
    },
    sourceTitleLink: {
      color: theme.accentBlue,
    },
    sourceName: {
      fontSize: ft.ff(10),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
  });
}
