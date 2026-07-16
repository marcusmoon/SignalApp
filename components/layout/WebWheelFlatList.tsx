import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  View,
  type FlatListProps,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  WEB_FLATLIST_ESTIMATED_ITEM_HEIGHT,
  WEB_FLATLIST_INITIAL,
  WEB_FLATLIST_OVERSCAN,
  webScrollViewportDataSet,
} from '@/constants/webLayout';
import { isDomNearScrollEnd, syntheticScrollEventFromDom } from '@/utils/listScrollLoadMoreGate';
import { useWebScrollResetOnKey } from '@/hooks/useWebScrollResetOnKey';
import { createLazyWebScrollApi } from '@/utils/scrollToTop';

const webListViewportStyle = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  height: '100%',
  maxHeight: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
} as const;

const webSeparators = {
  highlight: () => {},
  unhighlight: () => {},
  updateProps: () => {},
};

type EndReachedInfo = Parameters<NonNullable<FlatListProps<unknown>['onEndReached']>>[0];

function renderListSlot(slot: unknown) {
  if (!slot) return null;
  if (typeof slot === 'function') {
    const Slot = slot as React.ComponentType;
    return <Slot />;
  }
  return slot as React.ReactElement;
}

function getDefaultKey<T>(item: T, index: number) {
  const maybeKey = item as { key?: unknown; id?: unknown };
  if (maybeKey?.key != null) return String(maybeKey.key);
  if (maybeKey?.id != null) return String(maybeKey.id);
  return String(index);
}

type WebWheelFlatListProps<T> = FlatListProps<T> & {
  scrollResetKey?: string | number | null;
};

function WebWheelFlatListInner<T>(
  {
    data,
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    ItemSeparatorComponent,
    contentContainerStyle,
    style,
    onScroll,
    onEndReached,
    onEndReachedThreshold,
    onLayout,
    onContentSizeChange,
    refreshControl,
    scrollResetKey,
    numColumns = 1,
    columnWrapperStyle,
    initialNumToRender,
    maxToRenderPerBatch: _maxToRenderPerBatch,
    getItemLayout,
    ...rest
  }: WebWheelFlatListProps<T>,
  forwardedRef: React.Ref<FlatList<T>>,
) {
  const localRef = useRef<FlatList<T>>(null);
  const webRef = useRef<View>(null);
  const webContentRef = useRef<View>(null);
  const webEndSentinelRef = useRef<View>(null);
  const onLayoutRef = useRef(onLayout);
  const onContentSizeChangeRef = useRef(onContentSizeChange);
  const onScrollRef = useRef(onScroll);
  const onEndReachedRef = useRef(onEndReached);
  const onEndReachedThresholdRef = useRef(onEndReachedThreshold);
  const lastWebEndReachedAtRef = useRef(0);
  const heightsRef = useRef<Map<number, number>>(new Map());
  const scrollRafRef = useRef<number | null>(null);
  onLayoutRef.current = onLayout;
  onContentSizeChangeRef.current = onContentSizeChange;
  onScrollRef.current = onScroll;
  onEndReachedRef.current = onEndReached;
  onEndReachedThresholdRef.current = onEndReachedThreshold;

  const items = useMemo(() => Array.from(data ?? []), [data]);
  const initialWindow = typeof initialNumToRender === 'number' ? initialNumToRender : WEB_FLATLIST_INITIAL;
  const estimatedItemHeight = WEB_FLATLIST_ESTIMATED_ITEM_HEIGHT;
  const overscan = WEB_FLATLIST_OVERSCAN;
  const cols = Math.max(1, numColumns);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [heightsVersion, setHeightsVersion] = useState(0);

  useEffect(() => {
    heightsRef.current = new Map();
    setScrollTop(0);
    setHeightsVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset window metrics on filter/scroll-key change
  }, [scrollResetKey]);

  useEffect(() => {
    // Drop height entries beyond the new length after filter/pagination shrink.
    const map = heightsRef.current;
    for (const key of map.keys()) {
      if (key >= items.length) map.delete(key);
    }
  }, [items.length]);

  const measureItemHeight = useCallback((index: number, height: number) => {
    if (!(height > 0)) return;
    const prev = heightsRef.current.get(index);
    if (prev != null && Math.abs(prev - height) < 0.5) return;
    heightsRef.current.set(index, height);
    setHeightsVersion((v) => v + 1);
  }, []);

  const rowCount = Math.ceil(items.length / cols);

  const getRowHeight = useCallback(
    (rowIndex: number) => {
      if (getItemLayout) {
        const firstIndex = rowIndex * cols;
        const layout = getItemLayout(items as never, firstIndex);
        return layout.length;
      }
      let maxH = 0;
      let measured = false;
      for (let c = 0; c < cols; c++) {
        const index = rowIndex * cols + c;
        if (index >= items.length) break;
        const h = heightsRef.current.get(index);
        if (h != null) {
          measured = true;
          maxH = Math.max(maxH, h);
        }
      }
      return measured ? maxH : estimatedItemHeight;
    },
    [cols, estimatedItemHeight, getItemLayout, items, heightsVersion],
  );

  const { startRow, endRow, topSpacer, bottomSpacer } = useMemo(() => {
    if (rowCount === 0) {
      return { startRow: 0, endRow: -1, topSpacer: 0, bottomSpacer: 0 };
    }

    const overscanPx = overscan * estimatedItemHeight;
    const viewTop = Math.max(0, scrollTop - overscanPx);
    const viewBottom = scrollTop + Math.max(viewportHeight, estimatedItemHeight) + overscanPx;

    let acc = 0;
    let start = 0;
    for (let row = 0; row < rowCount; row++) {
      const h = getRowHeight(row);
      if (acc + h > viewTop) {
        start = row;
        break;
      }
      acc += h;
      if (row === rowCount - 1) start = row;
    }

    let end = start;
    let scan = acc;
    for (let row = start; row < rowCount; row++) {
      scan += getRowHeight(row);
      end = row;
      if (scan >= viewBottom) break;
    }

    // Before any scroll metrics: render a progressive window so TTI stays small.
    if (viewportHeight <= 0) {
      const coldEnd = Math.min(rowCount - 1, Math.ceil(initialWindow / cols) - 1);
      let coldTop = 0;
      let coldBottom = 0;
      for (let row = coldEnd + 1; row < rowCount; row++) coldBottom += getRowHeight(row);
      return { startRow: 0, endRow: Math.max(0, coldEnd), topSpacer: coldTop, bottomSpacer: coldBottom };
    }

    let top = 0;
    for (let row = 0; row < start; row++) top += getRowHeight(row);
    let bottom = 0;
    for (let row = end + 1; row < rowCount; row++) bottom += getRowHeight(row);

    return { startRow: start, endRow: end, topSpacer: top, bottomSpacer: bottom };
  }, [
    cols,
    estimatedItemHeight,
    getRowHeight,
    initialWindow,
    overscan,
    rowCount,
    scrollTop,
    viewportHeight,
    heightsVersion,
  ]);

  const emitWebLayout = useCallback((node: HTMLElement) => {
    setViewportHeight(node.clientHeight);
    onLayoutRef.current?.({
      nativeEvent: {
        layout: { height: node.clientHeight, width: node.clientWidth, x: 0, y: 0 },
      },
    } as LayoutChangeEvent);
  }, []);

  const emitWebContentSize = useCallback((node: HTMLElement) => {
    onContentSizeChangeRef.current?.(node.scrollWidth, node.scrollHeight);
  }, []);

  const emitWebScroll = useCallback((node: HTMLElement) => {
    const nextTop = node.scrollTop;
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTop(nextTop);
    });
    const event = syntheticScrollEventFromDom(node);
    onScrollRef.current?.(event as NativeSyntheticEvent<NativeScrollEvent>);
  }, []);

  const emitWebEndReached = useCallback((node: HTMLElement) => {
    const handler = onEndReachedRef.current;
    if (!handler) return;

    const threshold = typeof onEndReachedThresholdRef.current === 'number'
      ? onEndReachedThresholdRef.current
      : 0.5;
    const padPx = Math.max(120, node.clientHeight * threshold);
    if (!isDomNearScrollEnd(node, padPx)) return;

    const now = Date.now();
    if (now - lastWebEndReachedAtRef.current < 250) return;

    lastWebEndReachedAtRef.current = now;
    const contentHeight = node.scrollHeight;
    const distanceFromEnd = Math.max(0, contentHeight - (node.scrollTop + node.clientHeight));
    handler({ distanceFromEnd } as EndReachedInfo);
  }, []);

  const getWebNode = useCallback((event?: unknown) => (
    (event as { currentTarget?: HTMLElement | null } | undefined)?.currentTarget
    ?? (webRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.()
    ?? null
  ), []);

  const getWebScrollNode = useCallback(
    () =>
      (webRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
        ?.getScrollableNode?.() ?? null,
    [],
  );
  useWebScrollResetOnKey(getWebScrollNode, scrollResetKey, data);

  /** Sidebar pane toggles can skip RN onLayout — observe the scroll node directly on web. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let node: HTMLElement | null = null;
    let contentNode: HTMLElement | null = null;
    let sentinelNode: HTMLElement | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: ResizeObserver | null = null;
    let endObserver: IntersectionObserver | null = null;
    let handleScroll: (() => void) | null = null;
    let handleNearEndProbe: (() => void) | null = null;
    let nearEndProbeTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      node = (webRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
        ?.getScrollableNode?.() ?? null;
      contentNode = (webContentRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
        ?.getScrollableNode?.() ?? null;
      sentinelNode = (webEndSentinelRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
        ?.getScrollableNode?.() ?? null;
      if (!node || !contentNode) {
        retryTimer = setTimeout(attach, 50);
        return;
      }
      handleScroll = () => {
        if (!node) return;
        emitWebScroll(node);
        emitWebEndReached(node);
      };
      handleNearEndProbe = () => {
        if (nearEndProbeTimer) clearTimeout(nearEndProbeTimer);
        nearEndProbeTimer = setTimeout(() => {
          if (!node) return;
          emitWebScroll(node);
          emitWebEndReached(node);
        }, 40);
      };
      node.addEventListener('scroll', handleScroll, { passive: true });
      node.addEventListener('wheel', handleNearEndProbe, { passive: true });
      node.addEventListener('touchend', handleNearEndProbe, { passive: true });
      node.addEventListener('keyup', handleNearEndProbe);
      observer = new ResizeObserver(() => {
        if (!node || node.clientHeight <= 0) return;
        emitWebLayout(node);
        emitWebContentSize(node);
        emitWebEndReached(node);
      });
      observer.observe(node);
      observer.observe(contentNode);
      if (sentinelNode) {
        const threshold = typeof onEndReachedThresholdRef.current === 'number'
          ? onEndReachedThresholdRef.current
          : 0.5;
        const rootMargin = `${Math.max(120, node.clientHeight * threshold)}px 0px`;
        endObserver = new IntersectionObserver(
          (entries) => {
            if (!node) return;
            if (entries.some((entry) => entry.isIntersecting)) {
              emitWebScroll(node);
              emitWebEndReached(node);
            }
          },
          { root: node, rootMargin, threshold: 0.01 },
        );
        endObserver.observe(sentinelNode);
      }
      emitWebLayout(node);
      emitWebContentSize(node);
      emitWebEndReached(node);
    };

    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (nearEndProbeTimer) clearTimeout(nearEndProbeTimer);
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      if (node && handleScroll) node.removeEventListener('scroll', handleScroll);
      if (node && handleNearEndProbe) {
        node.removeEventListener('wheel', handleNearEndProbe);
        node.removeEventListener('touchend', handleNearEndProbe);
        node.removeEventListener('keyup', handleNearEndProbe);
      }
      observer?.disconnect();
      endObserver?.disconnect();
    };
  }, [emitWebContentSize, emitWebEndReached, emitWebLayout, emitWebScroll]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const timer = setTimeout(() => {
      const node = (webRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
        ?.getScrollableNode?.() ?? null;
      if (node) {
        emitWebContentSize(node);
        emitWebEndReached(node);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [data, ListEmptyComponent, ListFooterComponent, ListHeaderComponent, emitWebContentSize, emitWebEndReached]);

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayout?.(e);
  };

  if (Platform.OS === 'web') {
    const Separator = ItemSeparatorComponent as React.ComponentType | null | undefined;
    const webViewportProps = webScrollViewportDataSet
      ? ({ dataSet: webScrollViewportDataSet } as unknown as Record<string, unknown>)
      : undefined;
    const emitFromWebEvent = (event: unknown) => {
      const node = getWebNode(event);
      if (!node) return;
      emitWebScroll(node);
      emitWebEndReached(node);
    };
    const scheduleWebNearEndProbe = (event: unknown) => {
      const node = getWebNode(event);
      if (!node) return;
      setTimeout(() => {
        emitWebScroll(node);
        emitWebEndReached(node);
      }, 40);
    };
    const webEventProps = {
      onScroll: emitFromWebEvent,
      onWheel: scheduleWebNearEndProbe,
      onTouchEnd: scheduleWebNearEndProbe,
      onKeyUp: scheduleWebNearEndProbe,
    };
    const setWebRef = (instance: View | null) => {
      webRef.current = instance;
      const api = createLazyWebScrollApi(
        () => webRef.current as { getScrollableNode?: () => HTMLElement | null } | null,
      ) as unknown as FlatList<T>;

      if (typeof forwardedRef === 'function') {
        forwardedRef(api);
      } else if (forwardedRef) {
        forwardedRef.current = api;
      }
    };

    const renderIndexedItem = (item: T, index: number) => (
      <View
        key={keyExtractor?.(item, index) ?? getDefaultKey(item, index)}
        onLayout={(e) => measureItemHeight(index, e.nativeEvent.layout.height)}
        style={cols > 1 ? { flex: 1, minWidth: 0 } : undefined}>
        {renderItem?.({
          item,
          index,
          separators: webSeparators,
        } as ListRenderItemInfo<T>)}
      </View>
    );

    const rowViews: React.ReactElement[] = [];
    for (let row = startRow; row <= endRow; row++) {
      const rowStart = row * cols;
      if (cols > 1) {
        const rowItems = items.slice(rowStart, Math.min(items.length, rowStart + cols));
        rowViews.push(
          <View key={`web-row-${row}`} style={[{ flexDirection: 'row' }, columnWrapperStyle]}>
            {rowItems.map((item, colIndex) => renderIndexedItem(item, rowStart + colIndex))}
            {rowItems.length < cols
              ? Array.from({ length: cols - rowItems.length }, (_, padIndex) => (
                  <View key={`web-pad-${row}-${padIndex}`} style={{ flex: 1, minWidth: 0 }} />
                ))
              : null}
          </View>,
        );
      } else {
        const item = items[rowStart];
        if (!item) continue;
        rowViews.push(
          <View key={keyExtractor?.(item, rowStart) ?? getDefaultKey(item, rowStart)}>
            <View onLayout={(e) => measureItemHeight(rowStart, e.nativeEvent.layout.height)}>
              {renderItem?.({
                item,
                index: rowStart,
                separators: webSeparators,
              } as ListRenderItemInfo<T>)}
            </View>
            {Separator && rowStart < items.length - 1 ? <Separator /> : null}
          </View>,
        );
      }
    }

    return (
      <View
        ref={setWebRef}
        {...webViewportProps}
        style={[webListViewportStyle, style] as never}
        {...(webEventProps as Record<string, unknown>)}>
        <View ref={webContentRef} style={contentContainerStyle}>
          {renderListSlot(ListHeaderComponent)}
          {items.length === 0 ? renderListSlot(ListEmptyComponent) : null}
          {items.length > 0 ? (
            <>
              {topSpacer > 0 ? <View style={{ height: topSpacer }} /> : null}
              {rowViews}
              {bottomSpacer > 0 ? <View style={{ height: bottomSpacer }} /> : null}
            </>
          ) : null}
          <View ref={webEndSentinelRef} style={{ height: 1 }} />
          {renderListSlot(ListFooterComponent)}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      {...rest}
      numColumns={numColumns}
      columnWrapperStyle={columnWrapperStyle}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      ItemSeparatorComponent={ItemSeparatorComponent}
      contentContainerStyle={contentContainerStyle}
      style={style}
      onScroll={onScroll}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      onLayout={handleLayout}
      onContentSizeChange={onContentSizeChange}
      refreshControl={refreshControl}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={_maxToRenderPerBatch}
      getItemLayout={getItemLayout}
      ref={(instance) => {
        localRef.current = instance;
        if (typeof forwardedRef === 'function') {
          forwardedRef(instance);
        } else if (forwardedRef) {
          forwardedRef.current = instance;
        }
      }}
    />
  );
}

export const WebWheelFlatList = forwardRef(WebWheelFlatListInner) as <T>(
  props: WebWheelFlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement | null;
