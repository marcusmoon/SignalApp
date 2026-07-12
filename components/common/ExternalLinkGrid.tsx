import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  chunkExternalLinkGridItems,
  computeExternalLinkGridColumns,
  estimateExternalLinkContentWidth,
  resolveExternalLinkGridInnerWidth,
  type ExternalLinkGridColumnOptions,
} from '@/utils/externalLinkGrid';

type ExternalLinkGridProps<T> = {
  items: readonly T[];
  horizontalInset?: number;
  gap?: number;
  rowGap?: number;
  boxPaddingHorizontal?: number;
  columnOptions?: ExternalLinkGridColumnOptions;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  style?: ViewStyle;
};

export function ExternalLinkGrid<T>({
  items,
  horizontalInset = 0,
  gap = 6,
  rowGap = 6,
  boxPaddingHorizontal = 0,
  columnOptions,
  keyExtractor,
  renderItem,
  style,
}: ExternalLinkGridProps<T>) {
  const { width: windowWidth } = useWindowDimensions();
  const { useTwoPane, isWideLayout } = useResponsiveLayout();
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const estimatedInnerWidth = useMemo(
    () =>
      estimateExternalLinkContentWidth({
        windowWidth,
        isWideLayout,
        useTwoPane,
        horizontalInset,
        boxPaddingHorizontal,
      }),
    [boxPaddingHorizontal, horizontalInset, isWideLayout, useTwoPane, windowWidth],
  );

  const gridInnerWidth = useMemo(
    () =>
      resolveExternalLinkGridInnerWidth(measuredWidth, boxPaddingHorizontal, estimatedInnerWidth),
    [boxPaddingHorizontal, estimatedInnerWidth, measuredWidth],
  );

  const columns = useMemo(
    () =>
      computeExternalLinkGridColumns(gridInnerWidth, items.length, {
        gap,
        maxColumns: 4,
        preferredColumns: 3,
        ...columnOptions,
      }),
    [columnOptions, gap, gridInnerWidth, items.length],
  );

  const rows = useMemo(() => chunkExternalLinkGridItems(items, columns), [columns, items]);

  if (items.length === 0) return null;

  return (
    <View
      style={[styles.box, style]}
      onLayout={(event) => {
        const next = Math.max(0, event.nativeEvent.layout.width);
        setMeasuredWidth((prev) => (prev === next ? prev : next));
      }}>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[
              styles.gridRow,
              { gap, marginBottom: rowIndex === rows.length - 1 ? 0 : rowGap },
            ]}>
            {row.map((item) => (
              <View key={keyExtractor(item)} style={styles.gridCell}>
                {renderItem(item)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    alignSelf: 'stretch',
  },
  grid: {
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    width: '100%',
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
});
