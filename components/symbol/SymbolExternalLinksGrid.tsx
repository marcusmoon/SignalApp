import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import type { SymbolExternalLink } from '@/utils/symbolExternalLinks';

const GAP = 8;
const ROW_GAP = 14;
const BOX_PAD_H = 8;
const BOX_PAD_V = 12;
/** 더보기 숏링크(72)보다 크게 — 종목 상세 바로가기 */
const MIN_CELL_WIDTH = 88;

function chunkItems<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

function computeGridColumns(innerWidth: number, itemCount: number): number {
  if (innerWidth <= 0 || itemCount <= 0) return 1;

  const maxColumnsByWidth = Math.max(1, Math.floor((innerWidth + GAP) / (MIN_CELL_WIDTH + GAP)));
  const maxColumns = Math.min(maxColumnsByWidth, itemCount);

  let bestColumns = 1;
  let bestScore = -Infinity;

  for (let columns = maxColumns; columns >= 1; columns -= 1) {
    const cellWidth = (innerWidth - GAP * (columns - 1)) / columns;
    if (cellWidth < MIN_CELL_WIDTH) continue;

    const remainder = itemCount % columns;
    const orphanRatio = remainder === 0 ? 0 : remainder / columns;
    const score = (remainder === 0 ? 1000 : 0) + (1 - orphanRatio) * 100 + columns * 10;

    if (score > bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return Math.max(1, bestColumns);
}

type LinkCellProps = {
  link: SymbolExternalLink;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  label: string;
};

function LinkCell({ link, styles, theme, label }: LinkCellProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={() =>
        void openConfiguredExternalLink({
          webUrl: link.url,
          appLaunchUrls: link.appLaunchUrls,
          openInAppBrowser: link.openInAppBrowser,
        })
      }
      accessibilityRole="link"
      accessibilityLabel={label}>
      <View style={styles.iconArea}>
        {link.iconMark != null ? (
          <Text style={styles.iconMarkText} numberOfLines={1}>
            {link.iconMark}
          </Text>
        ) : link.icon != null ? (
          <FontAwesome name={link.icon} size={30} color={theme.textDim} />
        ) : (
          <FontAwesome name="external-link" size={26} color={theme.textDim} />
        )}
      </View>
      <Text style={styles.cellLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

type SymbolExternalLinksGridProps = {
  links: SymbolExternalLink[];
};

export function SymbolExternalLinksGrid({ links }: SymbolExternalLinksGridProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const [gridInnerWidth, setGridInnerWidth] = useState(0);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const columns = useMemo(
    () =>
      computeGridColumns(
        gridInnerWidth > 0 ? gridInnerWidth : 300,
        links.length,
      ),
    [gridInnerWidth, links.length],
  );

  const rows = useMemo(() => chunkItems(links, columns), [columns, links]);

  if (links.length === 0) return null;

  return (
    <View
      style={styles.box}
      onLayout={(event) => {
        const innerWidth = Math.max(
          0,
          event.nativeEvent.layout.width - BOX_PAD_H * 2,
        );
        setGridInnerWidth((prev) => (prev === innerWidth ? prev : innerWidth));
      }}>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[styles.gridRow, rowIndex === rows.length - 1 && styles.gridRowLast]}>
            {row.map((link) => (
              <View key={link.id} style={styles.gridCell}>
                <LinkCell
                  link={link}
                  styles={styles}
                  theme={theme}
                  label={t(link.labelKey)}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      width: '100%',
      paddingHorizontal: BOX_PAD_H,
      paddingVertical: BOX_PAD_V,
    },
    grid: {
      width: '100%',
    },
    gridRow: {
      flexDirection: 'row',
      gap: GAP,
      marginBottom: ROW_GAP,
    },
    gridRowLast: {
      marginBottom: 0,
    },
    gridCell: {
      flex: 1,
      minWidth: 0,
    },
    cell: {
      minHeight: 88,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconArea: {
      width: 52,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    iconMarkText: {
      fontSize: sf(12),
      fontWeight: '900',
      color: theme.textDim,
      letterSpacing: -0.3,
    },
    cellLabel: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      lineHeight: sf(15),
      minHeight: Math.round(sf(30)),
    },
  });
}
