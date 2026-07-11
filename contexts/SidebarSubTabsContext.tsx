/**
 * iPad 사이드바에 서브탭을 등록하기 위한 Context.
 * 각 탭 화면은 포커스 시 자신의 서브탭 목록을 등록하고, 블러 시 지운다.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

export type SidebarSubTab = {
  key: string;
  label: string;
  /** @deprecated activeSubTabKey를 사용한다. 하위 호환용으로만 남김 */
  active?: boolean;
  onPress: () => void;
};

type SidebarSubTabsContextType = {
  subTabs: SidebarSubTab[];
  activeSubTabKey: string | null;
  setSubTabs: (tabs: SidebarSubTab[]) => void;
  setActiveSubTabKey: (key: string | null) => void;
  clearSubTabs: () => void;
};

const SidebarSubTabsContext = createContext<SidebarSubTabsContextType>({
  subTabs: [],
  activeSubTabKey: null,
  setSubTabs: () => {},
  setActiveSubTabKey: () => {},
  clearSubTabs: () => {},
});

export function SidebarSubTabsProvider({ children }: { children: React.ReactNode }) {
  const [subTabs, setSubTabsState] = useState<SidebarSubTab[]>([]);
  const [activeSubTabKey, setActiveSubTabKeyState] = useState<string | null>(null);

  const setSubTabs = useCallback((tabs: SidebarSubTab[]) => {
    setSubTabsState(tabs);
  }, []);

  const setActiveSubTabKey = useCallback((key: string | null) => {
    setActiveSubTabKeyState(key);
  }, []);

  const clearSubTabs = useCallback(() => {
    setSubTabsState([]);
    setActiveSubTabKeyState(null);
  }, []);

  return (
    <SidebarSubTabsContext.Provider
      value={{ subTabs, activeSubTabKey, setSubTabs, setActiveSubTabKey, clearSubTabs }}>
      {children}
    </SidebarSubTabsContext.Provider>
  );
}

export function useSidebarSubTabs() {
  return useContext(SidebarSubTabsContext);
}
