import { useLocalSearchParams, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isSettingsTab, type SettingsTab } from '@/constants/settingsTabs';
import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import type { DisclosureFlowMarket, HomeDigestCategory, NewsIssuesCategory } from '@/constants/ipadHomeNav';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import { resolveIpadContentPaneFromPathname } from '@/utils/ipadContentPaneFromPath';

export type YoutubeSortKey = 'latest' | 'popular';

export type IpadContentPane = 'home' | 'tabs' | 'account' | 'settings' | 'newsIssues' | 'disclosureFlow';
export type IpadNewsIssuesPaneParams = {
  category: NewsIssuesCategory;
  date: string;
  digestId?: string | null;
};
export type IpadDisclosureFlowPaneParams = {
  date: string;
  market?: DisclosureFlowMarket;
  digestId?: string | null;
};

type IpadSidebarNavContextValue = {
  isAvailable: boolean;
  contentPane: IpadContentPane;
  isHomePaneActive: boolean;
  isAccountPaneActive: boolean;
  isSettingsPaneActive: boolean;
  settingsTab: SettingsTab;
  youtubeSort: YoutubeSortKey;
  newsIssuesParams: IpadNewsIssuesPaneParams | null;
  disclosureFlowParams: IpadDisclosureFlowPaneParams | null;
  showHome: () => void;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab) => void;
  showNewsIssues: (params: IpadNewsIssuesPaneParams) => void;
  showDisclosureFlow: (params: IpadDisclosureFlowPaneParams) => void;
  showYoutubeTab: (sort?: YoutubeSortKey) => void;
  showNewsTab: (segment?: NewsSegmentKey) => void;
  showSignalTab: (session?: SignalSessionKey, date?: string) => void;
  takePendingNewsSegment: () => NewsSegmentKey | null;
  takePendingSignalSession: () => SignalSessionKey | null;
  takePendingSignalDate: () => string | null;
};

const IpadSidebarNavContext = createContext<IpadSidebarNavContextValue>({
  isAvailable: false,
  contentPane: 'tabs',
  isHomePaneActive: false,
  isAccountPaneActive: false,
  isSettingsPaneActive: false,
  settingsTab: 'display',
  youtubeSort: 'latest',
  newsIssuesParams: null,
  disclosureFlowParams: null,
  showHome: () => {},
  showAccount: () => {},
  showTabs: () => {},
  showSettings: () => {},
  showNewsIssues: () => {},
  showDisclosureFlow: () => {},
  showYoutubeTab: () => {},
  showNewsTab: () => {},
  showSignalTab: () => {},
  takePendingNewsSegment: () => null,
  takePendingSignalSession: () => null,
  takePendingSignalDate: () => null,
});

export function IpadSidebarNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string | string[]; sort?: string | string[] }>();
  const restoredFromUrlRef = useRef(false);
  const [contentPane, setContentPane] = useState<IpadContentPane>(() =>
    resolveIpadContentPaneFromPathname(pathname),
  );
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => {
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    return isSettingsTab(tab) ? tab : 'display';
  });
  const [youtubeSort, setYoutubeSort] = useState<YoutubeSortKey>(() => {
    const sort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
    return sort === 'popular' ? 'popular' : 'latest';
  });
  const [newsIssuesParams, setNewsIssuesParams] = useState<IpadNewsIssuesPaneParams | null>(null);
  const [disclosureFlowParams, setDisclosureFlowParams] = useState<IpadDisclosureFlowPaneParams | null>(null);
  const pendingNewsSegmentRef = useRef<NewsSegmentKey | null>(null);
  const pendingSignalSessionRef = useRef<SignalSessionKey | null>(null);
  const pendingSignalDateRef = useRef<string | null>(null);

  /** 브라우저 새로고침: URL이 준비된 뒤 한 번만 pane을 복원한다. */
  useEffect(() => {
    if (restoredFromUrlRef.current) return;
    if (!pathname) return;
    restoredFromUrlRef.current = true;
    setContentPane(resolveIpadContentPaneFromPathname(pathname));
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (isSettingsTab(tab)) setSettingsTab(tab);
    if (pathname.includes('/youtube')) {
      const sort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
      if (sort === 'popular') setYoutubeSort('popular');
    }
  }, [pathname, params.sort, params.tab]);

  const showHome = useCallback(() => {
    setContentPane('home');
  }, []);

  const showAccount = useCallback(() => {
    setContentPane('account');
  }, []);

  const showTabs = useCallback(() => {
    setContentPane('tabs');
  }, []);

  const showSettings = useCallback((tab: SettingsTab = 'display') => {
    setSettingsTab(tab);
    setContentPane('settings');
  }, []);

  const showNewsIssues = useCallback((params: IpadNewsIssuesPaneParams) => {
    setNewsIssuesParams(params);
    setContentPane('newsIssues');
  }, []);

  const showDisclosureFlow = useCallback((params: IpadDisclosureFlowPaneParams) => {
    setDisclosureFlowParams(params);
    setContentPane('disclosureFlow');
  }, []);

  const showYoutubeTab = useCallback((sort: YoutubeSortKey = 'latest') => {
    setYoutubeSort(sort);
    setContentPane('tabs');
  }, []);

  const showNewsTab = useCallback((segment?: NewsSegmentKey) => {
    if (segment) pendingNewsSegmentRef.current = segment;
    setContentPane('tabs');
  }, []);

  const showSignalTab = useCallback((session?: SignalSessionKey, date?: string) => {
    if (session) pendingSignalSessionRef.current = session;
    if (date) pendingSignalDateRef.current = date;
    setContentPane('tabs');
  }, []);

  const takePendingNewsSegment = useCallback(() => {
    const segment = pendingNewsSegmentRef.current;
    pendingNewsSegmentRef.current = null;
    return segment;
  }, []);

  const takePendingSignalSession = useCallback(() => {
    const session = pendingSignalSessionRef.current;
    pendingSignalSessionRef.current = null;
    return session;
  }, []);

  const takePendingSignalDate = useCallback(() => {
    const date = pendingSignalDateRef.current;
    pendingSignalDateRef.current = null;
    return date;
  }, []);

  const value = useMemo(
    () => ({
      isAvailable: true,
      contentPane,
      isHomePaneActive: contentPane === 'home' || contentPane === 'newsIssues' || contentPane === 'disclosureFlow',
      isAccountPaneActive: contentPane === 'account',
      isSettingsPaneActive: contentPane === 'settings',
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      showHome,
      showAccount,
      showTabs,
      showSettings,
      showNewsIssues,
      showDisclosureFlow,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      takePendingNewsSegment,
      takePendingSignalSession,
      takePendingSignalDate,
    }),
    [
      contentPane,
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      showHome,
      showAccount,
      showSettings,
      showTabs,
      showNewsIssues,
      showDisclosureFlow,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      takePendingNewsSegment,
      takePendingSignalSession,
      takePendingSignalDate,
    ],
  );

  return <IpadSidebarNavContext.Provider value={value}>{children}</IpadSidebarNavContext.Provider>;
}

export function useIpadSidebarNav() {
  return useContext(IpadSidebarNavContext);
}
