import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
}: {
  items: QuoteTileItem[];
  styles: ReturnType<typeof makeMarketSnapshotStyles>;
}) {
  return (
    <View style={styles.quoteList}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <View key={item.key} style={[styles.quoteRow, isLast && styles.quoteRowLast]}>
            <View style={styles.quoteRowLeft}>
              <Text style={styles.quoteTitle} numberOfLines={1} ellipsizeMode="tail">
                {item.title}
              </Text>
              {item.sub ? (
                <Text style={styles.quoteSub} numberOfLines={1} ellipsizeMode="tail">
                  {item.sub}
                </Text>
              ) : null}
            </View>
            <View style={styles.quoteRowValues}>
              <Text style={styles.quotePrice}>{item.price}</Text>
              <Text style={[styles.quotePct, item.up ? styles.up : styles.dn]}>{item.pct}</Text>
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
};

export function MarketSnapshotSection({ tape, macro }: Props) {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeMarketSnapshotStyles(theme, scaleFont), [theme, scaleFont]);

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
  return StyleSheet.create({
    blockTitle: {
      fontSize: sf(11),
      fontWeight: '800',
      letterSpacing: 0.2,
      color: theme.textMuted,
      marginBottom: 6,
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
    quoteRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
    quoteRowLeft: { flex: 1, minWidth: 0, flexShrink: 1 },
    quoteTitle: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(16),
      flexShrink: 1,
    },
    quoteSub: {
      fontSize: sf(10),
      fontWeight: '600',
      color: theme.textMuted,
      marginTop: 2,
      lineHeight: sf(13),
      flexShrink: 1,
    },
    quoteRowValues: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: 8,
    },
    quotePrice: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      minWidth: 72,
      textAlign: 'right',
    },
    quotePct: { fontSize: sf(12), fontWeight: '700', minWidth: 58, textAlign: 'right' },
    up: { color: theme.green },
    dn: { color: '#ff6b6b' },
  });
}
