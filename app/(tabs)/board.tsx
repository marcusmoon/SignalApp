import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useIsFocused } from 'expo-router/react-navigation';
import { useCallback } from 'react';

import { BoardContent } from '@/components/community/BoardContent';
import { useOwnedSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function BoardScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const { clearSubTabs } = useOwnedSidebarSubTabs('board');

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      return () => clearSubTabs();
    }, [clearSubTabs, useTwoPane]),
  );

  return <BoardContent tabBarHeight={tabBarHeight} active={isFocused} />;
}
