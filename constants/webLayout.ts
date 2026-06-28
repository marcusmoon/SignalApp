import { Platform } from 'react-native';

/** Flex column child that must shrink so inner ScrollView/FlatList scroll on web. */
export const webFlexFill = {
  flex: 1,
  minHeight: 0,
} as const;

/** Bottom-tab scene wrapper: bounded height for list scroll on web. */
export const webTabSceneStyle = Platform.OS === 'web' ? webFlexFill : undefined;

/** Tab navigator host inside sidebar / wide layout. */
export const webTabNavigatorHostStyle =
  Platform.OS === 'web' ? ({ ...webFlexFill, height: '100%' as const } as const) : webFlexFill;
