import { forwardRef, useRef, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { webHorizontalCarouselScrollProps } from '@/constants/webLayout';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScrollBeginDrag?: () => void;
  scrollEnabled?: boolean;
};

/**
 * 가로 다이제스트 스트립.
 * 웹: 네이티브 overflow-x (브라우저 관성·트랙패드). 앱: ScrollView 관성 스크롤.
 */
export const WebHorizontalScrollStrip = forwardRef<ScrollView | View, Props>(
  function WebHorizontalScrollStrip(
    { children, style, contentContainerStyle, onScrollBeginDrag, scrollEnabled = true },
    forwardedRef,
  ) {
    const localRef = useRef<View | ScrollView | null>(null);

    if (Platform.OS === 'web') {
      return (
        <View
          {...webHorizontalCarouselScrollProps}
          ref={(instance) => {
            localRef.current = instance;
            if (typeof forwardedRef === 'function') {
              forwardedRef(instance as never);
            } else if (forwardedRef) {
              forwardedRef.current = instance as never;
            }
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
          if (typeof forwardedRef === 'function') {
            forwardedRef(instance);
          } else if (forwardedRef) {
            forwardedRef.current = instance;
          }
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
