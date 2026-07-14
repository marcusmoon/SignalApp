/**
 * iPad 사이드바에 서브탭을 등록하기 위한 Context.
 * 각 탭 화면은 포커스 시 자신의 서브탭 목록을 등록하고, 블러 시 지운다.
 *
 * Wide 웹: `href`+`params`로 URL을 갱신한다. 기본값도 쿼리에 명시해
 * 주소 직접 입력·링크 공유·새로고침이 같은 화면을 복원한다.
 *
 * clear는 owner가 일치할 때만 동작한다 — 탭 전환 시 이전 화면 blur가
 * 이미 등록된 다음 탭 서브메뉴를 지우는 경합을 막는다.
 */
import React, { createContext, useCallback, useContext, useRef, useState, useMemo } from 'react';

export type SidebarSubTabsOwner = 'news' | 'signal' | 'quotes' | 'disclosures' | 'board';

export type SidebarSubTab = {
  key: string;
  label: string;
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
  setSubTabs: (owner: SidebarSubTabsOwner, tabs: SidebarSubTab[]) => void;
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
  const [subTabs, setSubTabsState] = useState<SidebarSubTab[]>([]);
  const [activeSubTabKey, setActiveSubTabKeyState] = useState<string | null>(null);
  const [owner, setOwnerState] = useState<SidebarSubTabsOwner | null>(null);
  const ownerRef = useRef<SidebarSubTabsOwner | null>(null);

  const setSubTabs = useCallback((nextOwner: SidebarSubTabsOwner, tabs: SidebarSubTab[]) => {
    ownerRef.current = nextOwner;
    setOwnerState(nextOwner);
    setSubTabsState(tabs);
  }, []);

  const setActiveSubTabKey = useCallback((nextOwner: SidebarSubTabsOwner, key: string | null) => {
    if (ownerRef.current !== nextOwner) return;
    setActiveSubTabKeyState(key);
  }, []);

  const clearSubTabs = useCallback((nextOwner: SidebarSubTabsOwner) => {
    if (ownerRef.current !== nextOwner) return;
    ownerRef.current = null;
    setOwnerState(null);
    setSubTabsState([]);
    setActiveSubTabKeyState(null);
  }, []);

  const value = useMemo(
    () => ({
      subTabs,
      activeSubTabKey,
      owner,
      setSubTabs,
      setActiveSubTabKey,
      clearSubTabs,
    }),
    [subTabs, activeSubTabKey, owner, setSubTabs, setActiveSubTabKey, clearSubTabs],
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
    (tabs: SidebarSubTab[]) => setSubTabs(owner, tabs),
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
