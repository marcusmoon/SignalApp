import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REFERENCE_LINK_ITEMS, type ReferenceLinkItem } from '@/constants/referenceAppLinks';
import { APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { MessageId } from '@/locales/messages';
import { markSourceIconFailed } from '@/services/sourceIcon';
import {
  computeExternalLinkGridColumns,
  estimateExternalLinkContentWidth,
  resolveExternalLinkGridInnerWidth,
} from '@/utils/externalLinkGrid';
import { externalLinkFaviconUrl } from '@/utils/externalLinkFavicon';
import { openReferenceLink } from '@/utils/referenceLinkOpen';

const GAP = 6;
const ROW_GAP = 8;
const BOX_PAD = 8;
const MIN_CELL_WIDTH = 56;
const PREFERRED_COLUMNS = 4;

function chunkItems<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

type LinkCellProps = {
  item: ReferenceLinkItem;
  styles: ReturnType<typeof makeStyles>;
  label: string;
};

function LinkCell({ item, styles, label }: LinkCellProps) {
  const faviconUrl = useMemo(
    () => externalLinkFaviconUrl(item.id, item.webUrl, 32),
    [item.id, item.webUrl],
  );
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [faviconUrl]);

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={() => void openReferenceLink(item)}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.iconCircle}>
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

type LinkGridProps = {
  items: ReferenceLinkItem[];
  columns: number;
  styles: ReturnType<typeof makeStyles>;
  t: (id: MessageId) => string;
};

function LinkGrid({ items, columns, styles, t }: LinkGridProps) {
  const rows = useMemo(() => chunkItems(items, columns), [columns, items]);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[styles.gridRow, rowIndex === rows.length - 1 && styles.gridRowLast]}>
          {row.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              <LinkCell item={item} styles={styles} label={t(item.labelKey as MessageId)} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReferenceLinksSection() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const { useTwoPane, isWideLayout, width: windowWidth } = useResponsiveLayout();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const estimatedInnerWidth = useMemo(
    () =>
      estimateExternalLinkContentWidth({
        windowWidth,
        isWideLayout,
        useTwoPane,
        horizontalInset: APP_CONTENT_SIDE_PADDING,
        boxPaddingHorizontal: BOX_PAD,
      }),
    [isWideLayout, useTwoPane, windowWidth],
  );

  const gridInnerWidth = useMemo(
    () => resolveExternalLinkGridInnerWidth(measuredWidth, BOX_PAD, estimatedInnerWidth),
    [estimatedInnerWidth, measuredWidth],
  );

  const columns = useMemo(
    () =>
      computeExternalLinkGridColumns(gridInnerWidth, REFERENCE_LINK_ITEMS.length, {
        gap: GAP,
        minCellWidth: MIN_CELL_WIDTH,
        maxColumns: PREFERRED_COLUMNS,
        preferredColumns: PREFERRED_COLUMNS,
      }),
    [gridInnerWidth],
  );

  return (
    <View
      style={styles.box}
      onLayout={(event) => {
        const outerWidth = Math.max(0, event.nativeEvent.layout.width);
        setMeasuredWidth((prev) => (prev === outerWidth ? prev : outerWidth));
      }}>
      <LinkGrid items={REFERENCE_LINK_ITEMS} columns={columns} styles={styles} t={t} />
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: BOX_PAD,
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
      minHeight: 62,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconCircle: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    favicon: {
      width: 24,
      height: 24,
      borderRadius: 4,
    },
    faviconFallback: {
      width: 24,
      height: 24,
      borderRadius: 4,
      backgroundColor: theme.bgElevated,
    },
    cellLabel: {
      flex: 1,
      textAlignVertical: 'center',
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: sf(14),
      minHeight: Math.round(sf(14)),
    },
  });
}
