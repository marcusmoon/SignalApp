/**
 * Wide 사이드바 서브탭 상태 — React Context와 분리한 순수 로직.
 * 회귀 테스트(`subTabsState.test.ts`)의 대상.
 */

export type SidebarSubTabsOwner = 'news' | 'signal' | 'quotes' | 'disclosures' | 'board';

export type SidebarSubTabDef = {
  key: string;
  label: string;
};

export type SidebarSubTabsState = {
  owner: SidebarSubTabsOwner | null;
  tabs: SidebarSubTabDef[];
  activeKey: string | null;
};

export type SidebarSubTabsAction =
  | {
      type: 'setTabs';
      owner: SidebarSubTabsOwner;
      tabs: SidebarSubTabDef[];
      /** 전달 시 목록과 선택을 한 번에 맞춤 (재등록 경합 방지) */
      activeKey?: string | null;
    }
  | { type: 'setActive'; owner: SidebarSubTabsOwner; key: string | null }
  | { type: 'clear'; owner: SidebarSubTabsOwner };

export const INITIAL_SIDEBAR_SUB_TABS_STATE: SidebarSubTabsState = {
  owner: null,
  tabs: [],
  activeKey: null,
};

export function reduceSidebarSubTabs(
  state: SidebarSubTabsState,
  action: SidebarSubTabsAction,
): SidebarSubTabsState {
  switch (action.type) {
    case 'setTabs': {
      const next: SidebarSubTabsState = {
        owner: action.owner,
        tabs: action.tabs,
        activeKey: state.activeKey,
      };
      if (action.activeKey !== undefined) {
        next.activeKey = action.activeKey;
      }
      return next;
    }
    case 'setActive': {
      // clear 직후·최초: owner null이면 claim. 다른 owner면 무시.
      if (state.owner != null && state.owner !== action.owner) return state;
      return {
        ...state,
        owner: action.owner,
        activeKey: action.key,
      };
    }
    case 'clear': {
      if (state.owner !== action.owner) return state;
      return INITIAL_SIDEBAR_SUB_TABS_STATE;
    }
    default:
      return state;
  }
}
