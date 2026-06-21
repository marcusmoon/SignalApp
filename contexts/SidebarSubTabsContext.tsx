/**
 * iPad 사이드바에 서브탭을 등록하기 위한 Context.
 * 각 탭 화면은 포커스 시 자신의 서브탭 목록을 등록하고, 블러 시 지운다.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

export type SidebarSubTab = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type SidebarSubTabsContextType = {
  subTabs: SidebarSubTab[];
  setSubTabs: (tabs: SidebarSubTab[]) => void;
  clearSubTabs: () => void;
};

const SidebarSubTabsContext = createContext<SidebarSubTabsContextType>({
  subTabs: [],
  setSubTabs: () => {},
  clearSubTabs: () => {},
});

export function SidebarSubTabsProvider({ children }: { children: React.ReactNode }) {
  const [subTabs, setSubTabsState] = useState<SidebarSubTab[]>([]);

  const setSubTabs = useCallback((tabs: SidebarSubTab[]) => {
    setSubTabsState(tabs);
  }, []);

  const clearSubTabs = useCallback(() => {
    setSubTabsState([]);
  }, []);

  return (
    <SidebarSubTabsContext.Provider value={{ subTabs, setSubTabs, clearSubTabs }}>
      {children}
    </SidebarSubTabsContext.Provider>
  );
}

export function useSidebarSubTabs() {
  return useContext(SidebarSubTabsContext);
}
