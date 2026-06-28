import { Platform } from 'react-native';

/** Flex child for layout shells (safe areas, columns). Never use height:0 here. */
export const webFlexFill = {
  flex: 1,
  minHeight: 0,
} as const;

/**
 * ScrollView / FlatList viewport inside a bounded column.
 * Web wide panes need an explicit 100% height cap; otherwise RN Web can let
 * ScrollView grow to content height, leaving no internal scroll range.
 */
export const webScrollViewportStyle =
  Platform.OS === 'web'
    ? ({ flex: 1, minHeight: 0, height: '100%', maxHeight: '100%' } as const)
    : webFlexFill;

/** Bottom-tab scene wrapper: bounded height for list scroll on web. */
export const webTabSceneStyle = Platform.OS === 'web' ? webScrollViewportStyle : undefined;

/** Tab navigator host inside sidebar content pane. */
export const webTabNavigatorHostStyle = {
  ...webFlexFill,
  width: '100%' as const,
};

/**
 * Sidebar right pane in a flex row — must not use height:0 / flexBasis:0
 * (collapses cross-axis height in row layout).
 */
export const webSidebarContentStyle = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  alignSelf: 'stretch' as const,
  overflow: 'hidden' as const,
};

/** FlatList tuning on web — avoid rendering every tab's feed at once. */
export const WEB_FLATLIST_INITIAL = 12;
export const WEB_FLATLIST_WINDOW = 7;
export const WEB_FLATLIST_BATCH = 10;

/** Horizontal carousels on web — hide native scrollbars (use arrow nav instead). */
export const webHorizontalCarouselScrollProps =
  Platform.OS === 'web'
    ? ({
        showsHorizontalScrollIndicator: false as const,
        dataSet: { signalHorizontalCarousel: 'true' },
      } as const)
    : ({ showsHorizontalScrollIndicator: false as const } as const);
