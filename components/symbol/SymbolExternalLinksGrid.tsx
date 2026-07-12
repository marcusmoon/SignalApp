import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { markSourceIconFailed } from '@/services/sourceIcon';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { externalLinkFaviconUrl } from '@/utils/externalLinkFavicon';
import type { SymbolExternalLink } from '@/utils/symbolExternalLinks';

const GAP = 6;
const ROW_GAP = 8;
const BOX_PAD_H = 4;
const BOX_PAD_V = 6;
const MAX_COLUMNS = 3;
const MIN_CELL_WIDTH = 68;
const FAVICON_SIZE = 24;

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
  const maxColumns = Math.min(MAX_COLUMNS, maxColumnsByWidth, itemCount);

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
  label: string;
};

function LinkCell({ link, styles, label }: LinkCellProps) {
  const faviconUrl = useMemo(
    () => externalLinkFaviconUrl(link.id, link.url, 32),
    [link.id, link.url],
  );
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [faviconUrl]);

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
      <View style={styles.iconWrap}>
        {!iconFailed ? (
          <Image
            source={{ uri: faviconUrl }}
            style={styles.favicon}
            contentFit="contain"
            onError={() => {
              markSourceIconFailed(faviconUrl);
              setIconFailed(true);
            }}
          />
        ) : (
          <View style={styles.faviconFallback} />
        )}
      </View>
      <Text style={styles.cellLabel} numberOfLines={1}>
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
                <LinkCell link={link} styles={styles} label={t(link.labelKey)} />
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
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconWrap: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    favicon: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      borderRadius: 4,
    },
    faviconFallback: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      borderRadius: 4,
      backgroundColor: theme.bgElevated,
    },
    cellLabel: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: sf(12),
    },
  });
}
