/**
 * iPad 사이드바에 서브탭을 등록하기 위한 Context.
 * 상태 전이 규칙은 `domain/sidebar/subTabsState.ts` (회귀 테스트 대상).
 */
import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';

import {
  INITIAL_SIDEBAR_SUB_TABS_STATE,
  reduceSidebarSubTabs,
  type SidebarSubTabDef,
  type SidebarSubTabsOwner,
} from '@/domain/sidebar/subTabsState';

export type { SidebarSubTabsOwner };

export type SidebarSubTab = SidebarSubTabDef & {
  /** @deprecated activeSubTabKey를 사용한다. 하위 호환용으로만 남김 */
  active?: boolean;
  /** Expo Router pathname (예: `/(tabs)/board`) */
  href?: string;
  /** Query params — undefined 값은 제거 목적으로 전달 */
  params?: Record<string, string | undefined>;
  onPress?: () => void;
};

type SidebarSubTabsContextType = {
  subTabs: SidebarSubTab[];
  activeSubTabKey: string | null;
  owner: SidebarSubTabsOwner | null;
  setSubTabs: (
    owner: SidebarSubTabsOwner,
    tabs: SidebarSubTab[],
    activeKey?: string | null,
  ) => void;
  setActiveSubTabKey: (owner: SidebarSubTabsOwner, key: string | null) => void;
  clearSubTabs: (owner: SidebarSubTabsOwner) => void;
};

const SidebarSubTabsContext = createContext<SidebarSubTabsContextType>({
  subTabs: [],
  activeSubTabKey: null,
  owner: null,
  setSubTabs: () => {},
  setActiveSubTabKey: () => {},
  clearSubTabs: () => {},
});

export function SidebarSubTabsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduceSidebarSubTabs, INITIAL_SIDEBAR_SUB_TABS_STATE);
  // onPress 등 함수 props는 reducer 밖에 보관 (순수 상태와 분리).
  const [tabExtras, setTabExtras] = React.useState<SidebarSubTab[]>([]);
  const ownerRef = useRef<SidebarSubTabsOwner | null>(null);

  const setSubTabs = useCallback(
    (nextOwner: SidebarSubTabsOwner, tabs: SidebarSubTab[], activeKey?: string | null) => {
      ownerRef.current = nextOwner;
      setTabExtras(tabs);
      dispatch({
        type: 'setTabs',
        owner: nextOwner,
        tabs: tabs.map(({ key, label }) => ({ key, label })),
        activeKey,
      });
    },
    [],
  );

  const setActiveSubTabKey = useCallback((nextOwner: SidebarSubTabsOwner, key: string | null) => {
    if (ownerRef.current != null && ownerRef.current !== nextOwner) return;
    ownerRef.current = nextOwner;
    dispatch({ type: 'setActive', owner: nextOwner, key });
  }, []);

  const clearSubTabs = useCallback((nextOwner: SidebarSubTabsOwner) => {
    if (ownerRef.current !== nextOwner) return;
    ownerRef.current = null;
    setTabExtras([]);
    dispatch({ type: 'clear', owner: nextOwner });
  }, []);

  const subTabs = useMemo(() => {
    const byKey = new Map(tabExtras.map((tab) => [tab.key, tab]));
    return state.tabs.map((tab) => {
      const extra = byKey.get(tab.key);
      return extra ? { ...extra, key: tab.key, label: tab.label } : tab;
    });
  }, [state.tabs, tabExtras]);

  const value = useMemo(
    () => ({
      subTabs,
      activeSubTabKey: state.activeKey,
      owner: state.owner,
      setSubTabs,
      setActiveSubTabKey,
      clearSubTabs,
    }),
    [subTabs, state.activeKey, state.owner, setSubTabs, setActiveSubTabKey, clearSubTabs],
  );

  return <SidebarSubTabsContext.Provider value={value}>{children}</SidebarSubTabsContext.Provider>;
}

export function useSidebarSubTabs() {
  return useContext(SidebarSubTabsContext);
}

/** 화면별 owner에 묶인 서브탭 API — clear 경합을 피한다. */
export function useOwnedSidebarSubTabs(owner: SidebarSubTabsOwner) {
  const { subTabs, activeSubTabKey, setSubTabs, setActiveSubTabKey, clearSubTabs } = useSidebarSubTabs();
  const setOwnedSubTabs = useCallback(
    (tabs: SidebarSubTab[], activeKey?: string | null) => setSubTabs(owner, tabs, activeKey),
    [owner, setSubTabs],
  );
  const setOwnedActiveSubTabKey = useCallback(
    (key: string | null) => setActiveSubTabKey(owner, key),
    [owner, setActiveSubTabKey],
  );
  const clearOwnedSubTabs = useCallback(() => clearSubTabs(owner), [owner, clearSubTabs]);
  return {
    subTabs,
    activeSubTabKey,
    setSubTabs: setOwnedSubTabs,
    setActiveSubTabKey: setOwnedActiveSubTabKey,
    clearSubTabs: clearOwnedSubTabs,
  };
}
