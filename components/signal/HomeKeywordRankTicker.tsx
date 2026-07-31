import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { FEED_BODY_PX, FEED_SUMMARY_PX } from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import { homeKeywordChipLabel } from '@/domain/home/homeKeywordDisplay';
import { formatQuoteDpPct } from '@/domain/quotes/rows';
import { useQuoteChangeColors } from '@/hooks';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

/** Visible rows in the home keyword ticker viewport. */
export const HOME_KEYWORD_TICKER_VISIBLE = 2;
const ROW_HEIGHT = 36;
const ADVANCE_MS = 3400;
const SLIDE_MS = 280;

type Props = {
  items: HomeKeywordChip[];
  symbolNames: Map<string, string>;
  changes: Map<string, number>;
  onPressItem: (chip: HomeKeywordChip) => void;
  accessibilityLabel: string;
};

/**
 * Compact home keyword strip: clipped 2-row viewport that auto-advances
 * through the ranked list (Trends-style), pausing while a row is pressed.
 */
export function HomeKeywordRankTicker({
  items,
  symbolNames,
  changes,
  onPressItem,
  accessibilityLabel,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );

  const translateY = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const loopItems = useMemo(() => {
    if (items.length <= HOME_KEYWORD_TICKER_VISIBLE) return items;
    return [...items, ...items.slice(0, HOME_KEYWORD_TICKER_VISIBLE)];
  }, [items]);

  const resetOffset = useCallback(() => {
    indexRef.current = 0;
    translateY.stopAnimation();
    translateY.setValue(0);
  }, [translateY]);

  useEffect(() => {
    resetOffset();
  }, [items, resetOffset]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => setAppActive(next === 'active');
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!appActive || items.length <= HOME_KEYWORD_TICKER_VISIBLE) {
      resetOffset();
      return;
    }

    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const next = indexRef.current + 1;
      Animated.timing(translateY, {
        toValue: -next * ROW_HEIGHT,
        duration: SLIDE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        if (next >= items.length) {
          indexRef.current = 0;
          translateY.setValue(0);
        } else {
          indexRef.current = next;
        }
      });
    }, ADVANCE_MS);

    return () => clearInterval(timer);
  }, [appActive, items.length, resetOffset, translateY]);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  const viewportHeight =
    Math.min(HOME_KEYWORD_TICKER_VISIBLE, Math.max(items.length, 1)) * ROW_HEIGHT;

  return (
    <View
      style={[styles.viewport, { height: viewportHeight }]}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {loopItems.map((chip, index) => {
          const rank = (index % items.length) + 1;
          const isSymbol = chip.kind === 'symbol';
          const label = homeKeywordChipLabel(chip, symbolNames);
          const why = String(chip.why || '').trim();
          const pct = isSymbol ? changes.get(chip.label.trim().toUpperCase()) : undefined;
          const hasPct = typeof pct === 'number' && Number.isFinite(pct);
          const up = hasPct && pct >= 0;
          const a11y = why
            ? hasPct
              ? `${rank}. ${label}. ${why}. ${formatQuoteDpPct(pct)}`
              : `${rank}. ${label}. ${why}`
            : hasPct
              ? `${rank}. ${label}. ${formatQuoteDpPct(pct)}`
              : `${rank}. ${label}`;

          return (
            <Pressable
              key={`${chip.kind}:${chip.label}:${index}`}
              onPress={() => onPressItem(chip)}
              onPressIn={pause}
              onPressOut={resume}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.rank}>{rank}</Text>
              {isSymbol ? <SymbolLogo symbol={chip.label} size={16} /> : null}
              <Text style={styles.title} numberOfLines={1}>
                {label}
                {why ? <Text style={styles.why}>{` · ${why}`}</Text> : null}
              </Text>
              {hasPct ? (
                <Text
                  style={[
                    styles.change,
                    { color: up ? quoteChange.colors.up : quoteChange.colors.down },
                  ]}>
                  {formatQuoteDpPct(pct)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    viewport: {
      overflow: 'hidden',
    },
    row: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 0,
    },
    rank: {
      width: 16,
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textDim,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(FEED_BODY_PX),
      lineHeight: sf(17),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    why: {
      fontSize: ft.ff(FEED_SUMMARY_PX),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    change: {
      flexShrink: 0,
      marginLeft: 6,
      fontSize: ft.ff(FEED_BODY_PX),
      lineHeight: sf(17),
      fontWeight: ft.emphasisWeight,
      fontVariant: ['tabular-nums'],
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
