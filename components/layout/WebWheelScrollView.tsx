import { forwardRef, useRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';

export const WebWheelScrollView = forwardRef<ScrollView, ScrollViewProps>(function WebWheelScrollView(
  props,
  forwardedRef,
) {
  const localRef = useRef<ScrollView>(null);
  useWebVerticalWheelScroll(localRef);

  return (
    <ScrollView
      {...props}
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
});
