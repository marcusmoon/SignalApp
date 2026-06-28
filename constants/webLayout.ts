import { Platform } from 'react-native';

/** Flex child for layout shells (safe areas, columns). */
export const webFlexFill = {
  flex: 1,
  minHeight: 0,
} as const;

/**
 * ScrollView / FlatList viewport inside a bounded column.
 * flexBasis:0 keeps the scroll area from expanding to full content height on web.
 */
export const webScrollViewportStyle =
  Platform.OS === 'web'
    ? ({ flex: 1, minHeight: 0, flexBasis: 0 } as const)
    : webFlexFill;

/** Bottom-tab scene shell — fill the pane; inner lists use webScrollViewportStyle. */
export const webTabSceneStyle = Platform.OS === 'web' ? webFlexFill : undefined;

/** Tab navigator host inside sidebar content pane. */
export const webTabNavigatorHostStyle =
  Platform.OS === 'web'
    ? ({ ...webFlexFill, width: '100%' as const, height: '100%' as const } as const)
    : ({ ...webFlexFill, width: '100%' as const } as const);

/**
 * Sidebar right pane in a flex row — must stretch vertically on web.
 * Do NOT use height:0 / flexBasis:0 here (collapses cross-axis in row layout).
 */
export const webSidebarContentStyle =
  Platform.OS === 'web'
    ? ({
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        alignSelf: 'stretch' as const,
        height: '100%' as const,
      } as const)
    : ({
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        alignSelf: 'stretch' as const,
      } as const);

/** Direct child of sidebar content (home, tabs host, account, etc.). */
export const webSidebarPaneFill =
  Platform.OS === 'web'
    ? ({ ...webFlexFill, width: '100%' as const, height: '100%' as const } as const)
    : ({ ...webFlexFill, width: '100%' as const } as const);

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
