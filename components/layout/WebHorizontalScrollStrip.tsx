import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { webHorizontalCarouselScrollProps } from '@/constants/webLayout';

export type WebHorizontalScrollStripHandle = {
  scrollToStart: (animated?: boolean) => void;
};

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScrollBeginDrag?: () => void;
  scrollEnabled?: boolean;
};

function scrollNodeToStart(node: View | ScrollView | null, animated: boolean) {
  if (!node) return;
  if (Platform.OS === 'web') {
    const el = node as unknown as {
      scrollLeft?: number;
      scrollTo?: (opts: { left: number; behavior?: 'auto' | 'smooth' }) => void;
    };
    if (animated && typeof el.scrollTo === 'function') {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (typeof el.scrollLeft === 'number') {
      el.scrollLeft = 0;
    }
    return;
  }
  (node as ScrollView).scrollTo({ x: 0, animated });
}

/**
 * 가로 다이제스트 스트립.
 * 웹: 네이티브 overflow-x (브라우저 관성·트랙패드). 앱: ScrollView 관성 스크롤.
 */
export const WebHorizontalScrollStrip = forwardRef<WebHorizontalScrollStripHandle, Props>(
  function WebHorizontalScrollStrip(
    { children, style, contentContainerStyle, onScrollBeginDrag, scrollEnabled = true },
    ref,
  ) {
    const localRef = useRef<View | ScrollView | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        scrollToStart(animated = false) {
          scrollNodeToStart(localRef.current, animated);
          if (Platform.OS === 'web') {
            requestAnimationFrame(() => scrollNodeToStart(localRef.current, false));
          }
        },
      }),
      [],
    );

    if (Platform.OS === 'web') {
      return (
        <View
          {...webHorizontalCarouselScrollProps}
          ref={(instance) => {
            localRef.current = instance;
          }}
          onPointerDown={() => onScrollBeginDrag?.()}
          style={[webStripStyle, style]}>
          <View style={[webContentStyle, contentContainerStyle]}>{children}</View>
        </View>
      );
    }

    return (
      <ScrollView
        ref={(instance) => {
          localRef.current = instance;
        }}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        bounces
        overScrollMode="always"
        decelerationRate="normal"
        onScrollBeginDrag={onScrollBeginDrag}
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    );
  },
);

const webStripStyle = {
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
  touchAction: 'pan-x',
} as const;

const webContentStyle = {
  flexDirection: 'row',
  alignItems: 'stretch',
} as const;
