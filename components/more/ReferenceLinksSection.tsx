import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REFERENCE_LINK_ITEMS, type ReferenceLinkItem } from '@/constants/referenceAppLinks';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { openExternalLink } from '@/utils/openExternalLink';

const GAP = 6;
const ROW_GAP = 16;
const BOX_PAD = 10;
const MIN_CELL_WIDTH = 72;

function chunkItems<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

/** 가용 폭·항목 수에 맞춰 열 수를 고른다. 마지막 줄 빈 칸을 줄이고 셀 폭을 균등하게 채운다. */
export function computeReferenceLinkGridColumns(
  innerWidth: number,
  itemCount: number,
  gap = GAP,
  minCellWidth = MIN_CELL_WIDTH,
): number {
  if (innerWidth <= 0 || itemCount <= 0) return 1;

  const maxColumnsByWidth = Math.max(1, Math.floor((innerWidth + gap) / (minCellWidth + gap)));
  const maxColumns = Math.min(maxColumnsByWidth, itemCount);

  let bestColumns = 1;
  let bestScore = -Infinity;

  for (let columns = maxColumns; columns >= 1; columns -= 1) {
    const cellWidth = (innerWidth - gap * (columns - 1)) / columns;
    if (cellWidth < minCellWidth) continue;

    const remainder = itemCount % columns;
    const fullRows = remainder === 0;
    const orphanRatio = remainder === 0 ? 0 : remainder / columns;

    // 꽉 찬 행 우선, 동률이면 열 수가 많은 쪽(아이콘 숏컷은 촘촘한 그리드가 자연스럽다)
    const score = (fullRows ? 1000 : 0) + (1 - orphanRatio) * 100 + columns * 10;

    if (score > bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return Math.max(1, bestColumns);
}

type LinkCellProps = {
  item: ReferenceLinkItem;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  label: string;
};

function LinkCell({ item, styles, theme, label }: LinkCellProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={() =>
        void openExternalLink(item.webUrl, item.appLaunchUrls, {
          preferInAppBrowser: item.openInAppBrowser,
        })
      }
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.iconCircle}>
        {item.iconMark != null ? (
          <Text style={styles.iconMarkText} numberOfLines={1}>
            {item.iconMark}
          </Text>
        ) : (
          <FontAwesome name={item.icon!} size={26} color={theme.textDim} />
        )}
      </View>
      <Text style={styles.cellLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

type LinkGridProps = {
  items: ReferenceLinkItem[];
  columns: number;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  t: (id: MessageId) => string;
};

function LinkGrid({ items, columns, styles, theme, t }: LinkGridProps) {
  const rows = useMemo(() => chunkItems(items, columns), [columns, items]);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[styles.gridRow, rowIndex === rows.length - 1 && styles.gridRowLast]}>
          {row.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              <LinkCell item={item} styles={styles} theme={theme} label={t(item.labelKey)} />
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
  const [gridInnerWidth, setGridInnerWidth] = useState(0);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const columns = useMemo(
    () =>
      computeReferenceLinkGridColumns(
        gridInnerWidth > 0 ? gridInnerWidth : 280,
        REFERENCE_LINK_ITEMS.length,
      ),
    [gridInnerWidth],
  );

  return (
    <View
      style={styles.box}
      onLayout={(event) => {
        const innerWidth = Math.max(0, event.nativeEvent.layout.width - BOX_PAD * 2);
        setGridInnerWidth((prev) => (prev === innerWidth ? prev : innerWidth));
      }}>
      <LinkGrid
        items={REFERENCE_LINK_ITEMS}
        columns={columns}
        styles={styles}
        theme={theme}
        t={t}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      borderRadius: 13,
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
      minHeight: 74,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingHorizontal: 5,
      paddingVertical: 6,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconCircle: {
      width: 46,
      height: 36,
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
      paddingHorizontal: 0,
    },
    iconMarkText: {
      fontSize: sf(11),
      fontWeight: '900',
      color: theme.textDim,
      letterSpacing: -0.2,
    },
    cellLabel: {
      flex: 1,
      textAlignVertical: 'center',
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: sf(14),
      minHeight: Math.round(sf(24)),
    },
  });
}
