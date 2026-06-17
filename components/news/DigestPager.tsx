import { useCallback, useState } from 'react';
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsDigestItem } from '@/domain/news';

// Must match listContent paddingHorizontal in newsStyles.ts
const LIST_H_PAD = 16;

function relativeTime(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) {
      return locale === 'ko' ? '방금' : locale === 'ja' ? 'たった今' : 'just now';
    }
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (locale === 'ko') {
      if (minutes < 60) return `${minutes}분 전`;
      if (hours < 24) return `${hours}시간 전`;
      return `${days}일 전`;
    }
    if (locale === 'ja') {
      if (minutes < 60) return `${minutes}分前`;
      if (hours < 24) return `${hours}時間前`;
      return `${days}日前`;
    }
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return '';
  }
}

type Props = {
  batches: NewsDigestItem[][];
};

export function DigestPager({ batches }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - LIST_H_PAD * 2;
  const [pageIndex, setPageIndex] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const styles = makeStyles(theme, scaleFont);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.max(0, Math.min(index, batches.length - 1)));
    },
    [pageWidth, batches.length],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (batches.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.kicker}>
          <FontAwesome name="bolt" size={11} color={theme.green} />
          <Text style={styles.kickerText}>{t('feedDigestKicker')}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.9}
        snapToInterval={pageWidth}
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {batches.map((batch, batchIndex) => (
          <View
            key={batchIndex}
            style={[styles.page, { width: pageWidth }]}
          >
            {batch.map((digest) => {
              const isExpanded = expandedIds.has(digest.id);
              return (
                <Pressable
                  key={digest.id}
                  onPress={() => toggleExpand(digest.id)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={digest.title}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  {(digest.aiGenerated || digest.topics.length > 0) ? (
                    <View style={styles.badgeRow}>
                      {digest.aiGenerated ? (
                        <View style={styles.aiBadge}>
                          <Text style={styles.aiBadgeText}>✦ AI</Text>
                        </View>
                      ) : null}
                      {digest.topics.slice(0, 3).map((topic) => (
                        <Text key={topic} style={styles.topicChip} numberOfLines={1}>
                          {topic}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  <Text style={styles.title} numberOfLines={2}>
                    {digest.title}
                  </Text>

                  {isExpanded && digest.summary ? (
                    <Text style={styles.summary} numberOfLines={3}>
                      {digest.summary}
                    </Text>
                  ) : null}

                  {isExpanded && (digest.sourceRefs.length > 0 || digest.sources.length > 0) ? (
                    <View style={styles.sourceList}>
                      {digest.sourceRefs.length > 0
                        ? digest.sourceRefs.slice(0, 5).map((ref, i) => (
                            <Pressable
                              key={i}
                              onPress={
                                ref.url
                                  ? (e) => {
                                      e.stopPropagation?.();
                                      void Linking.openURL(ref.url!).catch(() => null);
                                    }
                                  : undefined
                              }
                              style={({ pressed }) => [
                                styles.sourceRow,
                                pressed && ref.url && styles.sourceRowPressed,
                              ]}
                              accessibilityRole={ref.url ? 'link' : 'text'}
                            >
                              <Text
                                style={[styles.sourceName, ref.url && styles.sourceNameLink]}
                                numberOfLines={1}
                              >
                                {ref.sourceName || ref.url || ''}
                              </Text>
                              {ref.url ? (
                                <FontAwesome name="external-link" size={10} color={theme.accentBlue} />
                              ) : null}
                            </Pressable>
                          ))
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
                      {t('feedDigestSummary', {
                        count: String(digest.count),
                        sources: String(digest.sources.length),
                      })}
                      {digest.generatedAt ? ` · ${relativeTime(digest.generatedAt, locale)}` : ''}
                    </Text>
                    <FontAwesome
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={11}
                      color={theme.textDim}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {batches.length > 1 ? (
        <View style={styles.dotsRow}>
          {batches.map((_, i) => (
            <View key={i} style={[styles.dot, i === pageIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    kicker: {
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    kickerText: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.green,
    },
    page: {
      gap: 8,
    },
    card: {
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      gap: 6,
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
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
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: `${theme.accentBlue}18`,
      borderWidth: 1,
      borderColor: `${theme.accentBlue}44`,
    },
    aiBadgeText: {
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.accentBlue,
    },
    topicChip: {
      overflow: 'hidden',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '800',
      color: theme.textMuted,
    },
    title: {
      fontSize: sf(15),
      lineHeight: sf(21),
      fontWeight: '900',
      color: theme.text,
    },
    summary: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.textMuted,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    footer: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '700',
      color: theme.textDim,
      flex: 1,
    },
    sourceList: {
      gap: 3,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    sourceRowPressed: {
      opacity: 0.7,
    },
    sourceName: {
      fontSize: sf(11),
      lineHeight: sf(16),
      fontWeight: '600',
      color: theme.textMuted,
      flex: 1,
    },
    sourceNameLink: {
      color: theme.accentBlue,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 14,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.green,
    },
  });
}
