import { useEffect, useMemo, useState } from 'react';

import { colorWithAlpha, glassEdgeColors } from '@/components/signal/GlassSurface';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  loadTabBarOpacityLevel,
  subscribeTabBarOpacityChanged,
  tabBarOpacityForLevel,
  type TabBarOpacityLevel,
} from '@/services/tabBarOpacityPreference';

export function useTabBarGlassStyle() {
  const { theme, effectiveColorScheme } = useSignalTheme();
  const [opacityLevel, setOpacityLevel] = useState<TabBarOpacityLevel>(3);

  useEffect(() => {
    void loadTabBarOpacityLevel().then(setOpacityLevel);
    return subscribeTabBarOpacityChanged(() => {
      void loadTabBarOpacityLevel().then(setOpacityLevel);
    });
  }, []);

  const backgroundColor = useMemo(
    () => colorWithAlpha(theme.card, tabBarOpacityForLevel(opacityLevel)),
    [opacityLevel, theme.card],
  );

  const edge = useMemo(
    () => glassEdgeColors(effectiveColorScheme, theme.border),
    [effectiveColorScheme, theme.border],
  );

  return { backgroundColor, edge, effectiveColorScheme };
}
