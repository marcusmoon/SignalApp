import { forwardRef, useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  Platform,
  View,
  type FlatListProps,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native';

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
  onLayoutRef.current = onLayout;
  onContentSizeChangeRef.current = onContentSizeChange;
  onScrollRef.current = onScroll;
  onEndReachedRef.current = onEndReached;
  onEndReachedThresholdRef.current = onEndReachedThreshold;

  const emitWebLayout = useCallback((node: HTMLElement) => {
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
    const event = syntheticScrollEventFromDom(node);
    onScrollRef.current?.(event);
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
    const items = Array.from(data ?? []);
    const Separator = ItemSeparatorComponent as React.ComponentType | null | undefined;
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

    return (
      <View ref={setWebRef} style={[webListViewportStyle, style] as never} {...(webEventProps as Record<string, unknown>)}>
        <View ref={webContentRef} style={contentContainerStyle}>
          {renderListSlot(ListHeaderComponent)}
          {items.length === 0 ? renderListSlot(ListEmptyComponent) : null}
          {numColumns > 1
            ? (() => {
                const rowViews: React.ReactElement[] = [];
                for (let rowStart = 0; rowStart < items.length; rowStart += numColumns) {
                  const rowItems = items.slice(rowStart, rowStart + numColumns);
                  const rowIndex = rowStart / numColumns;
                  rowViews.push(
                    <View
                      key={`web-row-${rowIndex}`}
                      style={[{ flexDirection: 'row' }, columnWrapperStyle]}>
                      {rowItems.map((item, colIndex) => {
                        const index = rowStart + colIndex;
                        return (
                          <View
                            key={keyExtractor?.(item, index) ?? getDefaultKey(item, index)}
                            style={{ flex: 1, minWidth: 0 }}>
                            {renderItem?.({
                              item,
                              index,
                              separators: webSeparators,
                            } as ListRenderItemInfo<T>)}
                          </View>
                        );
                      })}
                      {rowItems.length < numColumns
                        ? Array.from({ length: numColumns - rowItems.length }, (_, padIndex) => (
                            <View key={`web-pad-${rowIndex}-${padIndex}`} style={{ flex: 1, minWidth: 0 }} />
                          ))
                        : null}
                    </View>,
                  );
                }
                return rowViews;
              })()
            : items.map((item, index) => (
                <View key={keyExtractor?.(item, index) ?? getDefaultKey(item, index)}>
                  {renderItem?.({
                    item,
                    index,
                    separators: webSeparators,
                  } as ListRenderItemInfo<T>)}
                  {Separator && index < items.length - 1 ? <Separator /> : null}
                </View>
              ))}
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
