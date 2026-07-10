import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { NewsDigestItem } from '@/domain/news';
import type { AppLocale } from '@/locales/messages';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatRelativeFromIso } from '@/utils/date';

type Props = {
  digest: NewsDigestItem;
};

export function NewsDigestIssueCard({ digest }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const relativeLabel = digest.generatedAt
    ? formatRelativeFromIso(digest.generatedAt, locale as AppLocale)
    : '';
  const metaLine = t('feedDigestSummary', {
    count: String(digest.count),
    sources: String(digest.sources.length),
  });

  const openRef = useCallback((url: string | null | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    void WebBrowser.openBrowserAsync(trimmed).catch(() => Linking.openURL(trimmed).catch(() => null));
  }, []);

  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={digest.title}>
      <View style={styles.accentLine} />
      {digest.aiGenerated ? (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✦ AI</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{digest.title}</Text>
      <Text style={styles.summary}>{digest.summary}</Text>
      {digest.symbols.length > 0 ? (
        <Text style={styles.symbols} numberOfLines={1}>
          {digest.symbols.join(' · ')}
        </Text>
      ) : null}
      {expanded && digest.sourceRefs.length > 0 ? (
        <View style={styles.sourceList}>
          {digest.sourceRefs.slice(0, 8).map((ref, index) => (
            <Pressable
              key={`${ref.id}-${index}`}
              onPress={(event) => {
                event.stopPropagation?.();
                openRef(ref.url);
              }}
              style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
              accessibilityRole={ref.url ? 'link' : 'text'}>
              <Text style={[styles.sourceTitle, ref.url ? styles.sourceTitleLink : null]} numberOfLines={2}>
                {ref.title || ref.sourceName}
              </Text>
              {ref.sourceName ? (
                <Text style={styles.sourceName} numberOfLines={1}>
                  {ref.sourceName}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.footerRow}>
        <Text style={styles.footer} numberOfLines={1}>
          {[metaLine, relativeLabel].filter(Boolean).join(' · ')}
        </Text>
        <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textDim} />
      </View>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: ft.pad(14),
      paddingTop: ft.pad(14),
      paddingBottom: ft.pad(12),
      marginBottom: 10,
      overflow: 'hidden',
    },
    cardPressed: {
      opacity: 0.92,
    },
    accentLine: {
      position: 'absolute',
      left: 0,
      top: 12,
      bottom: 12,
      width: CONTENT_ACCENT_LINE_WIDTH,
      borderRadius: 2,
      backgroundColor: theme.green,
    },
    aiBadge: {
      alignSelf: 'flex-start',
      marginBottom: ft.pad(6),
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    aiBadgeText: {
      fontSize: ft.ff(10),
      fontWeight: '800',
      color: theme.green,
    },
    title: {
      color: theme.text,
      fontSize: ft.ff(16),
      lineHeight: ft.ff(22),
      fontWeight: '800',
      marginBottom: ft.pad(6),
    },
    summary: {
      color: theme.text,
      fontSize: ft.ff(14),
      lineHeight: ft.ff(21),
      fontWeight: ft.bodyWeight,
      marginBottom: ft.pad(8),
    },
    symbols: {
      color: theme.green,
      fontSize: ft.ff(12),
      fontWeight: '700',
      marginBottom: ft.pad(6),
    },
    sourceList: {
      marginTop: ft.pad(4),
      marginBottom: ft.pad(8),
      gap: 6,
    },
    sourceRow: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    sourceRowPressed: {
      opacity: 0.85,
    },
    sourceTitle: {
      color: theme.text,
      fontSize: ft.ff(13),
      lineHeight: ft.ff(18),
      fontWeight: '600',
    },
    sourceTitleLink: {
      color: theme.accentBlue,
    },
    sourceName: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: ft.ff(11),
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    footer: {
      flex: 1,
      color: theme.textMuted,
      fontSize: sf(11),
      fontWeight: '600',
    },
  });
}
