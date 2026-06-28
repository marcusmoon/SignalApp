import { forwardRef, useRef } from 'react';
import { FlatList, type FlatListProps } from 'react-native';

import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';

function WebWheelFlatListInner<T>(
  { onScroll, onEndReached, ...rest }: FlatListProps<T>,
  forwardedRef: React.Ref<FlatList<T>>,
) {
  const localRef = useRef<FlatList<T>>(null);
  useWebVerticalWheelScroll(localRef, {
    onScroll,
    onEndReached: onEndReached ? () => onEndReached({ distanceFromEnd: 0 }) : undefined,
  });

  return (
    <FlatList
      {...rest}
      onScroll={onScroll}
      onEndReached={onEndReached}
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
  props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement | null;
