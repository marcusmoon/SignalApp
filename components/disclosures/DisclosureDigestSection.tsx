/**
 * 공시 탭 상단 - US/Korea 주요 이슈 다이제스트 섹션
 */
import { memo, useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';

function relativeTime(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return locale === 'ko' ? '방금' : 'just now';
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (locale === 'ko') {
      if (minutes < 60) return `${minutes}분 전`;
      if (hours < 24) return `${hours}시간 전`;
      return `${days}일 전`;
    }
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return '';
  }
}

function marketLabel(market: string, locale: string): string {
  if (market === 'kr') return locale === 'ko' ? '한국 공시' : 'Korea';
  return locale === 'ko' ? '미국 공시' : 'US';
}

type DigestCardProps = {
  item: SignalApiDisclosureDigestItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
};

const DigestCard = memo(function DigestCard({ item, isExpanded, onToggle }: DigestCardProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { locale } = useLocale();
  const s = makeStyles(theme, scaleFont);

  const relLabel = relativeTime(item.generatedAt, locale);
  const mktLabel = marketLabel(item.market, locale);

  const handleToggle = useCallback(() => onToggle(item.id), [item.id, onToggle]);

  return (
    <Pressable
      onPress={handleToggle}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}>
      {/* 헤더 */}
      <View style={s.cardHeader}>
        <View style={s.marketBadge}>
          <Text style={s.marketBadgeText}>{mktLabel}</Text>
        </View>
        {item.count > 1 ? (
          <Text style={s.countLabel}>{item.count}건</Text>
        ) : null}
        {relLabel ? <Text style={s.timeLabel}>{relLabel}</Text> : null}
        <FontAwesome5
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={10}
          color={theme.textDim}
          style={s.chevron}
        />
      </View>

      {/* 제목 */}
      <Text style={s.title} numberOfLines={isExpanded ? undefined : 2}>
        {item.title}
      </Text>

      {/* 요약 */}
      {item.summary ? (
        <Text style={s.summary} numberOfLines={isExpanded ? undefined : 1}>
          {item.summary}
        </Text>
      ) : null}

      {/* 심볼 태그 */}
      {item.symbols.length > 0 ? (
        <View style={s.tags}>
          {item.symbols.slice(0, 4).map((sym) => (
            <View key={sym} style={s.tag}>
              <Text style={s.tagText}>{sym}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* 확장: 출처 목록 */}
      {isExpanded && item.sourceRefs.length > 0 ? (
        <View style={s.sourceList}>
          {item.sourceRefs.slice(0, 6).map((ref) => (
            <Pressable
              key={ref.id}
              style={({ pressed }) => [s.sourceRow, pressed && s.sourceRowPressed]}
              onPress={() => ref.url && Linking.openURL(ref.url).catch(() => {})}
              accessibilityRole="link">
              <View style={s.sourceDot} />
              <View style={s.sourceInfo}>
                <Text style={s.sourceTitle} numberOfLines={2}>
                  {ref.title || ref.companyName}
                </Text>
                {ref.formType ? (
                  <Text style={s.sourceForm}>{ref.formType}</Text>
                ) : null}
              </View>
              {ref.url ? (
                <FontAwesome5 name="external-link-alt" size={10} color={theme.textDim} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
});

type Props = {
  items: SignalApiDisclosureDigestItem[];
  loading?: boolean;
};

export function DisclosureDigestSection({ items, loading }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { locale } = useLocale();
  const s = makeStyles(theme, scaleFont);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <View style={s.section}>
      {/* 섹션 헤더 */}
      <View style={s.sectionHeader}>
        <FontAwesome5 name="fire" size={12} color={theme.green} solid />
        <Text style={s.sectionTitle}>
          {locale === 'ko' ? '주요 공시' : 'Key Filings'}
        </Text>
      </View>

      {/* 가로 스크롤 카드 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}>
        {items.map((item) => (
          <DigestCard
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={handleToggle}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useSignalTheme>['theme'],
  sf: (n: number) => number,
) {
  return StyleSheet.create({
    section: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      paddingBottom: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
    },
    sectionTitle: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textDim,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    scrollContent: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 8,
    },
    card: {
      width: 240,
      backgroundColor: theme.bgElevated,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    cardPressed: { opacity: 0.75 },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    marketBadge: {
      backgroundColor: theme.greenDim,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    marketBadgeText: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.green,
    },
    countLabel: {
      fontSize: sf(11),
      color: theme.textDim,
    },
    timeLabel: {
      fontSize: sf(11),
      color: theme.textDim,
      marginLeft: 'auto',
    },
    chevron: {
      marginLeft: 4,
    },
    title: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(18),
      marginBottom: 4,
    },
    summary: {
      fontSize: sf(12),
      color: theme.textDim,
      lineHeight: sf(16),
      marginBottom: 6,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 2,
    },
    tag: {
      backgroundColor: theme.card,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    tagText: {
      fontSize: sf(11),
      color: theme.textMuted,
      fontWeight: '600',
    },
    sourceList: {
      marginTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingTop: 8,
      gap: 6,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    sourceRowPressed: { opacity: 0.7 },
    sourceDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.green,
      marginTop: 5,
      flexShrink: 0,
    },
    sourceInfo: {
      flex: 1,
    },
    sourceTitle: {
      fontSize: sf(12),
      color: theme.text,
      lineHeight: sf(16),
    },
    sourceForm: {
      fontSize: sf(11),
      color: theme.textDim,
      marginTop: 1,
    },
  });
}
