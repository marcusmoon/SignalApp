import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

/** Set by +html inline script before React; survives static-export hydration. */
export const WEB_THEME_BG = 'var(--signal-bg)' as const;

export function webShellBackground(themeBg: string): string {
  return isWeb ? WEB_THEME_BG : themeBg;
}

export const WEB_SIGNAL_CSS = {
  bg: WEB_THEME_BG,
  card: 'var(--signal-card)',
  border: 'var(--signal-border)',
  text: 'var(--signal-text)',
  textMuted: 'var(--signal-text-muted)',
  green: 'var(--signal-green)',
  topHighlight: 'rgba(255,255,255,0.1)',
} as const;

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
  isWeb
    ? ({ flex: 1, minHeight: 0, height: '100%', maxHeight: '100%' } as const)
    : webFlexFill;

/** Bottom-tab scene wrapper: bounded height for list scroll on web. */
export const webTabSceneStyle = isWeb ? webScrollViewportStyle : undefined;

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
  isWeb
    ? ({
        showsHorizontalScrollIndicator: false as const,
        dataSet: { signalHorizontalCarousel: 'true' },
      } as const)
    : ({ showsHorizontalScrollIndicator: false as const } as const);
