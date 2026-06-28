import { Platform } from 'react-native';

/** Flex column child that must shrink so inner ScrollView/FlatList scroll on web. */
export const webFlexFill =
  Platform.OS === 'web'
    ? ({ flex: 1, minHeight: 0, height: 0 } as const)
    : ({ flex: 1, minHeight: 0 } as const);

/** FlatList / ScrollView viewport on web — height:0 + flex:1 prevents content-height expansion. */
export const webScrollViewportStyle = webFlexFill;

/** Bottom-tab scene wrapper: bounded height for list scroll on web. */
export const webTabSceneStyle = Platform.OS === 'web' ? webFlexFill : undefined;

/** Tab navigator host inside sidebar / wide layout. */
export const webTabNavigatorHostStyle = webFlexFill;
