import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import type { RouterAction } from 'expo-quick-actions/router';

import type { MessageId } from '@/locales/messages';

type Translate = (id: MessageId, vars?: Record<string, string | number>) => string;

const QUICK_ACTION_ROUTES = {
  market: '/(tabs)/signal',
  board: '/(tabs)/board',
  youtube: '/(tabs)/youtube',
  filings: '/(tabs)/disclosures',
} as const;

export async function syncAppQuickActions(t: Translate): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await QuickActions.isSupported())) return;

  await QuickActions.setItems<RouterAction>([
    {
      id: 'market',
      title: t('tabSignal'),
      icon: Platform.select({ ios: 'symbol:chart.line.uptrend.xyaxis' }),
      params: { href: QUICK_ACTION_ROUTES.market },
    },
    {
      id: 'board',
      title: t('screenBoard'),
      icon: Platform.select({ ios: 'symbol:text.bubble' }),
      params: { href: QUICK_ACTION_ROUTES.board },
    },
    {
      id: 'youtube',
      title: t('tabYoutube'),
      icon: Platform.select({ ios: 'symbol:play.rectangle' }),
      params: { href: QUICK_ACTION_ROUTES.youtube },
    },
    {
      id: 'filings',
      title: t('tabDisclosures'),
      icon: Platform.select({ ios: 'symbol:doc.text' }),
      params: { href: QUICK_ACTION_ROUTES.filings },
    },
  ]);
}
