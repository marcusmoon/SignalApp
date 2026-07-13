import type { MessageId } from '@/locales/messages';

export type SettingsTab = 'display' | 'notifications' | 'news' | 'quotes' | 'server';

export const SETTINGS_TAB_ORDER: SettingsTab[] = [
  'display',
  'notifications',
  'news',
  'quotes',
  'server',
];

export const SETTINGS_TABS: { key: SettingsTab; labelId: MessageId }[] = [
  { key: 'display', labelId: 'settingsTabDisplay' },
  { key: 'notifications', labelId: 'settingsTabNotifications' },
  { key: 'news', labelId: 'settingsTabNews' },
  { key: 'quotes', labelId: 'settingsTabQuotes' },
  { key: 'server', labelId: 'settingsTabDevMode' },
];

export function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TAB_ORDER.includes(value as SettingsTab);
}
