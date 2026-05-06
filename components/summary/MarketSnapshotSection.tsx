import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BACKGROUND,
  SEGMENT_TAB_BTN_PADDING_V,
  SEGMENT_TAB_BTN_RADIUS,
  SEGMENT_TAB_FONT_SIZE,
  SEGMENT_TAB_FONT_WEIGHT,
  SEGMENT_TAB_GAP,
  SEGMENT_TAB_LINE_HEIGHT,
  SEGMENT_TAB_OUTER_RADIUS,
  SEGMENT_TAB_PADDING,
} from '@/constants/segmentTabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import {
  MARKET_SNAPSHOT_MACRO_ROWS,
  MARKET_SNAPSHOT_TAPE_SYMBOLS,
} from '@/services/marketSnapshotQuotes';
import type { SignalApiMarketQuote } from '@/integrations/signal-api/types';

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(n >= 1 ? 2 : 4);
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function effectiveDp(q: SignalApiMarketQuote): number {
  const dp = Number(q.changePercent);
  if (Number.isFinite(dp)) return dp;
  const c = Number(q.currentPrice);
  const pc = Number(q.previousClose);
  if (Number.isFinite(c) && Number.isFinite(pc) && pc !== 0) {
    return ((c - pc) / pc) * 100;
  }
  return Number.NaN;
}

type QuoteTileItem = {
  key: string;
  title: string;
  sub?: string;
  price: string;
  pct: string;
  up: boolean;
};

function QuoteRowList({
  items,
  styles,
  prominent,
}: {
  items: QuoteTileItem[];
  styles: ReturnType<typeof makeMarketSnapshotStyles>;
  prominent?: boolean;
}) {
  return (
    <View style={styles.quoteList}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <View key={item.key} style={[styles.quoteRow, isLast && styles.quoteRowLast, prominent && styles.quoteRowProminent]}>
            <View style={styles.quoteRowLeft}>
              <Text
                style={[styles.quoteTitle, prominent && styles.quoteTitleProminent]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {item.title}
              </Text>
              {item.sub ? (
                <Text
                  style={[styles.quoteSub, prominent && styles.quoteSubProminent]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.sub}
                </Text>
              ) : null}
            </View>
            <View style={styles.quoteRowValues}>
              <Text style={[styles.quotePrice, prominent && styles.quotePriceProminent]}>{item.price}</Text>
              <Text style={[styles.quotePct, prominent && styles.quotePctProminent, item.up ? styles.up : styles.dn]}>
                {item.pct}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

type Props = {
  tape: Record<string, SignalApiMarketQuote | null>;
  macro: Record<string, SignalApiMarketQuote | null>;
  compact?: boolean;
};

type MarketCompactTab = 'tape' | 'macro';

const MARKET_TAB_DEF: readonly { key: MarketCompactTab; label: MessageId }[] = [
  { key: 'tape', label: 'briefingMarketTabTape' },
  { key: 'macro', label: 'briefingMarketTabMacro' },
];

export function MarketSnapshotSection({ tape, macro, compact = false }: Props) {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeMarketSnapshotStyles(theme, scaleFont), [theme, scaleFont]);
  const [marketTab, setMarketTab] = useState<MarketCompactTab>('tape');

  const tapeItems: QuoteTileItem[] = useMemo(
    () =>
      [...MARKET_SNAPSHOT_TAPE_SYMBOLS].map((sym) => {
        const q = tape[sym];
        if (!q) {
          return { key: sym, title: sym, price: '—', pct: '—', up: true };
        }
        const dp = effectiveDp(q);
        const up = (Number.isFinite(dp) ? dp : 0) >= 0;
        const c = Number(q.currentPrice);
        return {
          key: sym,
          title: sym,
          price: `$${formatUsd(c)}`,
          pct: formatPct(dp),
          up,
        };
      }),
    [tape],
  );

  const macroItems: QuoteTileItem[] = useMemo(
    () =>
      MARKET_SNAPSHOT_MACRO_ROWS.map((row: { key: MessageId; symbol: string }) => {
        const q = macro[row.symbol];
        const isFx = row.symbol.startsWith('OANDA:');
        const sub = isFx ? row.symbol.replace(/^OANDA:/, '') : row.symbol;
        if (!q) {
          return { key: row.symbol, title: t(row.key), sub, price: '—', pct: '—', up: true };
        }
        const dp = effectiveDp(q);
        const up = (Number.isFinite(dp) ? dp : 0) >= 0;
        const c = Number(q.currentPrice);
        return {
          key: row.symbol,
          title: t(row.key),
          sub,
          price: isFx ? formatUsd(c) : `$${formatUsd(c)}`,
          pct: formatPct(dp),
          up,
        };
      }),
    [macro, t],
  );

  if (compact) {
    return (
      <>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.blockTitleEmph}>{t('briefingSectionMarket')}</Text>
        </View>
        <View style={styles.marketSegment}>
          {MARKET_TAB_DEF.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setMarketTab(key)}
              style={[styles.marketSegBtn, marketTab === key && styles.marketSegBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: marketTab === key }}>
              <Text style={[styles.marketSegText, marketTab === key && styles.marketSegTextActive]}>{t(label)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.compactShell}>
          <Text style={styles.zoneHint} numberOfLines={2}>
            {marketTab === 'tape' ? t('marketSectionTape') : t('marketSectionMacro')}
          </Text>
          <QuoteRowList
            items={marketTab === 'tape' ? tapeItems : macroItems}
            styles={styles}
            prominent
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Text style={styles.blockTitle}>{t('briefingSectionMarket')}</Text>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('marketSectionTape')}</Text>
        <QuoteRowList items={tapeItems} styles={styles} />
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>{t('marketSectionMacro')}</Text>
        <QuoteRowList items={macroItems} styles={styles} />
      </View>
    </>
  );
}

function makeMarketSnapshotStyles(theme: AppTheme, sf: (n: number) => number) {
  const greenTint =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}12` : theme.bgElevated;

  return StyleSheet.create({
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    sectionTitleAccent: {
      width: 4,
      height: 18,
      borderRadius: 2,
      backgroundColor: theme.green,
    },
    blockTitleEmph: {
      fontSize: sf(13),
      fontWeight: '900',
      letterSpacing: -0.2,
      color: theme.text,
      flex: 1,
      minWidth: 0,
    },
    blockTitle: {
      fontSize: sf(11),
      fontWeight: '800',
      letterSpacing: 0.2,
      color: theme.textMuted,
      marginBottom: 6,
    },
    compactShell: {
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.greenBorder,
      backgroundColor: greenTint,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    marketSegment: {
      flexDirection: 'row',
      backgroundColor: SEGMENT_TAB_BACKGROUND,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 10,
      gap: SEGMENT_TAB_GAP,
    },
    marketSegBtn: {
      flex: 1,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
      borderRadius: SEGMENT_TAB_BTN_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    marketSegBtnActive: {
      backgroundColor: theme.green,
    },
    marketSegText: {
      fontSize: sf(SEGMENT_TAB_FONT_SIZE),
      lineHeight: sf(SEGMENT_TAB_LINE_HEIGHT),
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    marketSegTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    zoneHint: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textMuted,
      lineHeight: sf(14),
      marginBottom: 10,
    },
    sectionCard: {
      marginBottom: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: {
      fontSize: sf(12),
      fontWeight: '800',
      letterSpacing: 0.2,
      color: theme.textMuted,
      marginBottom: 8,
    },
    quoteList: { marginTop: 2 },
    quoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: 8,
    },
    quoteRowProminent: {
      paddingVertical: 12,
      borderBottomColor: theme.greenBorder,
    },
    quoteRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
    quoteRowLeft: { flex: 1, minWidth: 0, flexShrink: 1 },
    quoteTitle: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(16),
      flexShrink: 1,
    },
    quoteTitleProminent: {
      fontSize: sf(15),
      fontWeight: '900',
      lineHeight: sf(20),
      letterSpacing: -0.25,
    },
    quoteSub: {
      fontSize: sf(10),
      fontWeight: '600',
      color: theme.textMuted,
      marginTop: 2,
      lineHeight: sf(13),
      flexShrink: 1,
    },
    quoteSubProminent: {
      fontSize: sf(11),
      lineHeight: sf(14),
      marginTop: 3,
    },
    quoteRowValues: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: 10,
    },
    quotePrice: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      minWidth: 72,
      textAlign: 'right',
    },
    quotePriceProminent: {
      fontSize: sf(17),
      fontWeight: '800',
      minWidth: 78,
      letterSpacing: -0.3,
    },
    quotePct: { fontSize: sf(12), fontWeight: '700', minWidth: 58, textAlign: 'right' },
    quotePctProminent: { fontSize: sf(14), fontWeight: '800', minWidth: 64 },
    up: { color: theme.green },
    dn: { color: '#ff6b6b' },
  });
}
