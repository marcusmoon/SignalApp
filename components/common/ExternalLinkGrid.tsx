import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  computeExternalLinkGridColumns,
  estimateExternalLinkContentWidth,
  externalLinkGridCellWidth,
  resolveExternalLinkGridInnerWidth,
  type ExternalLinkGridColumnOptions,
} from '@/utils/externalLinkGrid';

type ExternalLinkGridProps<T> = {
  items: readonly T[];
  horizontalInset?: number;
  gap?: number;
  boxPaddingHorizontal?: number;
  columnOptions?: ExternalLinkGridColumnOptions;
  keyExtractor: (item: T) => string;
  renderItem: (item: T, cellWidth: number) => React.ReactNode;
  style?: ViewStyle;
};

export function ExternalLinkGrid<T>({
  items,
  horizontalInset = 0,
  gap = 6,
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

  const cellWidth = useMemo(() => {
    const width = externalLinkGridCellWidth(gridInnerWidth, columns, gap);
    return width > 0 ? width : gridInnerWidth / Math.max(1, columns);
  }, [columns, gap, gridInnerWidth]);

  if (items.length === 0) return null;

  return (
    <View
      style={[styles.box, style]}
      onLayout={(event) => {
        const next = Math.max(0, event.nativeEvent.layout.width);
        setMeasuredWidth((prev) => (prev === next ? prev : next));
      }}>
      <View style={[styles.grid, { gap }]}>
        {items.map((item) => (
          <View key={keyExtractor(item)} style={{ width: cellWidth, maxWidth: cellWidth }}>
            {renderItem(item, cellWidth)}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
