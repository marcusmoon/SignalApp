import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import type { HomeDigestCategory } from '@/constants/ipadHomeNav';
import type { SettingsTab } from '@/constants/settingsTabs';
import type { NewsSegmentKey } from '@/constants/newsSegment';

export type YoutubeSortKey = 'latest' | 'popular';

export type IpadContentPane = 'home' | 'tabs' | 'account' | 'settings' | 'newsIssues' | 'disclosureFlow';
export type IpadNewsIssuesPaneParams = {
  category: HomeDigestCategory;
  date: string;
  digestId?: string | null;
};
export type IpadDisclosureFlowPaneParams = {
  date: string;
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
  const [contentPane, setContentPane] = useState<IpadContentPane>('home');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('display');
  const [youtubeSort, setYoutubeSort] = useState<YoutubeSortKey>('latest');
  const [newsIssuesParams, setNewsIssuesParams] = useState<IpadNewsIssuesPaneParams | null>(null);
  const [disclosureFlowParams, setDisclosureFlowParams] = useState<IpadDisclosureFlowPaneParams | null>(null);
  const pendingNewsSegmentRef = useRef<NewsSegmentKey | null>(null);
  const pendingSignalSessionRef = useRef<SignalSessionKey | null>(null);
  const pendingSignalDateRef = useRef<string | null>(null);

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
