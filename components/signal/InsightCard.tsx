import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import type { SignalApiInsight } from '@/integrations/signal-api/types';
import { primaryInsightSourceRef } from '@/utils/primaryInsightSourceRef';

type Props = {
  insight: SignalApiInsight;
  theme: AppTheme;
  scaleFont: (n: number) => number;
  onOpenUrl: (url: string) => void;
  /** 홈 피드용 짧은 요약 */
  compact?: boolean;
  /** 홈 시그널 블록 안 — 바깥 테두리와 맞춰 더 옅은 면·약한 테두리 */
  embedded?: boolean;
};

export function InsightCard({ insight, theme, scaleFont, onOpenUrl, compact, embedded }: Props) {
  const styles = useMemo(
    () => makeInsightCardStyles(theme, scaleFont, embedded === true),
    [embedded, theme, scaleFont],
  );
  const primaryRef = primaryInsightSourceRef(insight);
  const url = primaryRef?.url?.trim();
  const summaryLines = compact ? 2 : 4;

  return (
    <Pressable
      onPress={() => {
        if (url) onOpenUrl(url);
      }}
      disabled={!url}
      style={({ pressed }) => [styles.card, pressed && Boolean(url) && styles.cardPressed]}>
      <View style={styles.cardHead}>
        <Text style={styles.level}>{insight.level.toUpperCase()}</Text>
        <Text style={styles.score}>{insight.score}</Text>
      </View>
      <Text style={styles.title} numberOfLines={compact ? 2 : 3}>
        {insight.title}
      </Text>
      <Text style={styles.summary} numberOfLines={summaryLines}>
        {insight.summary}
      </Text>
      <View style={styles.metaRow}>
        {insight.symbols.slice(0, compact ? 3 : 6).map((symbol) => (
          <Text key={`${insight.id}-${symbol}`} style={styles.symbol}>
            {symbol}
          </Text>
        ))}
        {primaryRef?.sourceName ? (
          <Text style={styles.ref} numberOfLines={1}>
            {primaryRef.sourceName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function insightTintSurface(theme: AppTheme): string {
  return theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}14` : theme.card;
}

function makeInsightCardStyles(theme: AppTheme, sf: (n: number) => number, embedded: boolean) {
  return StyleSheet.create({
    card: {
      padding: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderLeftWidth: embedded ? 1 : 3,
      borderColor: embedded ? theme.border : theme.greenBorder,
      borderLeftColor: embedded ? theme.border : theme.green,
      backgroundColor: embedded ? insightTintSurface(theme) : theme.card,
      gap: 7,
    },
    cardPressed: {
      opacity: 0.88,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    level: {
      color: theme.green,
      fontSize: sf(11),
      fontWeight: '900',
    },
    score: {
      color: theme.textMuted,
      fontSize: sf(12),
      fontWeight: '900',
    },
    title: {
      color: theme.text,
      fontSize: sf(15),
      lineHeight: sf(20),
      fontWeight: '900',
    },
    summary: {
      color: theme.textMuted,
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    symbol: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      overflow: 'hidden',
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      fontSize: sf(11),
      fontWeight: '900',
    },
    ref: {
      flex: 1,
      minWidth: 0,
      color: theme.textDim,
      fontSize: sf(11),
      fontWeight: '700',
    },
  });
}
