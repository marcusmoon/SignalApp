/**
 * 공시 탭 상단 - 뉴스 주요 이슈(DigestPager)와 동일한 자유 가로 스크롤 스트립
 */
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { WebHorizontalScrollStrip } from '@/components/layout/WebHorizontalScrollStrip';
import { DigestSourcesSheet, type DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { CONTENT_ACCENT_LINE_WIDTH, homeSectionAccentColor, type HomeAccentSection } from '@/constants/homeSectionAccent';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { disclosureDigestCreatedIso } from '@/domain/digests/createdAt';
import { formatFeedItemTimeLabel } from '@/utils/date';

const CARD_GAP = 10;
const CARD_EDGE_PAD = 12;
const CARD_WIDTH_RATIO = 0.88;

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

type DigestCardProps = {
  item: SignalApiDisclosureDigestItem;
  onOpenSources: (item: SignalApiDisclosureDigestItem) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
};

const DigestCard = memo(function DigestCard({ item, onOpenSources, styles, theme }: DigestCardProps) {
  const { t, locale } = useLocale();
  const summaryText = t('disclosuresDigestSummary', {
    count: String(item.count),
    symbols: String(item.symbols.length),
  });
  const createdLabel = formatFeedItemTimeLabel(disclosureDigestCreatedIso(item), locale as AppLocale);
  const topicChips = [
    ...new Set([
      marketChipLabel(item.market, locale),
      ...item.symbols.slice(0, 3),
      ...item.forms.slice(0, 2),
    ]),
  ].filter(Boolean);
  const showSources = item.sourceRefs.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.accentLine} />
      {topicChips.length > 0 ? (
        <View style={styles.badgeRow}>
          {topicChips.map((chip, index) => (
            <Text key={`${chip}-${index}`} style={styles.topicChip} numberOfLines={1}>
              {chip}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>
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
};

export function DisclosureDigestSection({ items, loading, accentColor, accentSection }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [sourcesItem, setSourcesItem] = useState<SignalApiDisclosureDigestItem | null>(null);
  const cardWidth = Math.max(0, Math.floor(containerWidth * CARD_WIDTH_RATIO));
  const resolvedAccent = accentSection ? homeSectionAccentColor(accentSection, theme) : accentColor;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, resolvedAccent),
    [theme, scaleFont, feedTypo, resolvedAccent],
  );

  const openSources = useCallback((item: SignalApiDisclosureDigestItem) => {
    setSourcesItem(item);
  }, []);

  const closeSources = useCallback(() => {
    setSourcesItem(null);
  }, []);

  const sourceRows = useMemo(
    () => (sourcesItem ? disclosureSourceRows(sourcesItem) : []),
    [sourcesItem],
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
        onScrollBeginDrag={closeSources}
        contentContainerStyle={styles.scrollContent}>
        {cardWidth > 0 &&
          items.map((item) => (
            <View key={item.id} style={[styles.cardSlot, { width: cardWidth }]}>
              <DigestCard item={item} onOpenSources={openSources} styles={styles} theme={theme} />
            </View>
          ))}
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
  accentColor?: string,
) {
  return StyleSheet.create({
    container: {
      marginBottom: 10,
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
    accentLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: CONTENT_ACCENT_LINE_WIDTH,
      backgroundColor: accentColor || theme.warning,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      alignItems: 'center',
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
