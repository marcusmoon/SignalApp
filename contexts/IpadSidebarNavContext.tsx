import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { SettingsTab } from '@/constants/settingsTabs';

export type YoutubeSortKey = 'latest' | 'popular';

export type IpadContentPane = 'tabs' | 'account' | 'settings';

type IpadSidebarNavContextValue = {
  isAvailable: boolean;
  contentPane: IpadContentPane;
  isAccountPaneActive: boolean;
  isSettingsPaneActive: boolean;
  settingsTab: SettingsTab;
  youtubeSort: YoutubeSortKey;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab) => void;
  showYoutubeTab: (sort?: YoutubeSortKey) => void;
};

const IpadSidebarNavContext = createContext<IpadSidebarNavContextValue>({
  isAvailable: false,
  contentPane: 'tabs',
  isAccountPaneActive: false,
  isSettingsPaneActive: false,
  settingsTab: 'display',
  youtubeSort: 'latest',
  showAccount: () => {},
  showTabs: () => {},
  showSettings: () => {},
  showYoutubeTab: () => {},
});

export function IpadSidebarNavProvider({ children }: { children: ReactNode }) {
  const [contentPane, setContentPane] = useState<IpadContentPane>('tabs');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('display');
  const [youtubeSort, setYoutubeSort] = useState<YoutubeSortKey>('latest');

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

  const value = useMemo(
    () => ({
      isAvailable: true,
      contentPane,
      isAccountPaneActive: contentPane === 'account',
      isSettingsPaneActive: contentPane === 'settings',
      settingsTab,
      youtubeSort,
      showAccount,
      showTabs,
      showSettings,
      showYoutubeTab,
    }),
    [contentPane, settingsTab, youtubeSort, showAccount, showSettings, showTabs, showYoutubeTab],
  );

  return <IpadSidebarNavContext.Provider value={value}>{children}</IpadSidebarNavContext.Provider>;
}

export function useIpadSidebarNav() {
  return useContext(IpadSidebarNavContext);
}
