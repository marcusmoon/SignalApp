import { Platform } from 'react-native';

/** Flex child for layout shells (safe areas, columns, sidebar panes). */
export const webFlexFill = {
  flex: 1,
  minHeight: 0,
} as const;

/**
 * ScrollView / FlatList viewport inside a bounded column.
 * height:0 on web stops the list from expanding to full content height (which breaks wheel scroll).
 */
export const webScrollViewportStyle =
  Platform.OS === 'web'
    ? ({ flex: 1, minHeight: 0, flexBasis: 0 } as const)
    : webFlexFill;

/** Bottom-tab scene wrapper: bounded height for list scroll on web. */
export const webTabSceneStyle = Platform.OS === 'web' ? webScrollViewportStyle : undefined;

/** Tab navigator host inside sidebar content pane. */
export const webTabNavigatorHostStyle = webFlexFill;

/** Sidebar content pane (flex row child — must not use height:0). */
export const webSidebarContentStyle = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  alignSelf: 'stretch' as const,
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

