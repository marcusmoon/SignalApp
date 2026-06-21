import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import type { SettingsTab } from '@/constants/settingsTabs';
import type { NewsSegmentKey } from '@/constants/newsSegment';

export type YoutubeSortKey = 'latest' | 'popular';

export type IpadContentPane = 'home' | 'tabs' | 'account' | 'settings';

type IpadSidebarNavContextValue = {
  isAvailable: boolean;
  contentPane: IpadContentPane;
  isHomePaneActive: boolean;
  isAccountPaneActive: boolean;
  isSettingsPaneActive: boolean;
  settingsTab: SettingsTab;
  youtubeSort: YoutubeSortKey;
  showHome: () => void;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab) => void;
  showYoutubeTab: (sort?: YoutubeSortKey) => void;
  showNewsTab: (segment?: NewsSegmentKey) => void;
  showSignalTab: (session?: SignalSessionKey) => void;
  takePendingNewsSegment: () => NewsSegmentKey | null;
  takePendingSignalSession: () => SignalSessionKey | null;
};

const IpadSidebarNavContext = createContext<IpadSidebarNavContextValue>({
  isAvailable: false,
  contentPane: 'tabs',
  isHomePaneActive: false,
  isAccountPaneActive: false,
  isSettingsPaneActive: false,
  settingsTab: 'display',
  youtubeSort: 'latest',
  showHome: () => {},
  showAccount: () => {},
  showTabs: () => {},
  showSettings: () => {},
  showYoutubeTab: () => {},
  showNewsTab: () => {},
  showSignalTab: () => {},
  takePendingNewsSegment: () => null,
  takePendingSignalSession: () => null,
});

export function IpadSidebarNavProvider({ children }: { children: ReactNode }) {
  const [contentPane, setContentPane] = useState<IpadContentPane>('home');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('display');
  const [youtubeSort, setYoutubeSort] = useState<YoutubeSortKey>('latest');
  const pendingNewsSegmentRef = useRef<NewsSegmentKey | null>(null);
  const pendingSignalSessionRef = useRef<SignalSessionKey | null>(null);

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

  const showYoutubeTab = useCallback((sort: YoutubeSortKey = 'latest') => {
    setYoutubeSort(sort);
    setContentPane('tabs');
  }, []);

  const showNewsTab = useCallback((segment?: NewsSegmentKey) => {
    if (segment) pendingNewsSegmentRef.current = segment;
    setContentPane('tabs');
  }, []);

  const showSignalTab = useCallback((session?: SignalSessionKey) => {
    if (session) pendingSignalSessionRef.current = session;
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

  const value = useMemo(
    () => ({
      isAvailable: true,
      contentPane,
      isHomePaneActive: contentPane === 'home',
      isAccountPaneActive: contentPane === 'account',
      isSettingsPaneActive: contentPane === 'settings',
      settingsTab,
      youtubeSort,
      showHome,
      showAccount,
      showTabs,
      showSettings,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      takePendingNewsSegment,
      takePendingSignalSession,
    }),
    [
      contentPane,
      settingsTab,
      youtubeSort,
      showHome,
      showAccount,
      showSettings,
      showTabs,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      takePendingNewsSegment,
      takePendingSignalSession,
    ],
  );

  return <IpadSidebarNavContext.Provider value={value}>{children}</IpadSidebarNavContext.Provider>;
}

export function useIpadSidebarNav() {
  return useContext(IpadSidebarNavContext);
}
