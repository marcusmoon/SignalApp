import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import type { Href } from 'expo-router';

import { messages, type AppLocale, type MessageId } from '@/locales/messages';

export const QUICK_ACTION_IDS = ['market', 'board', 'youtube', 'filings'] as const;

export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

export const QUICK_ACTION_HREFS: Record<QuickActionId, Href> = {
  market: '/(tabs)/signal',
  board: '/(tabs)/board',
  youtube: '/(tabs)/youtube',
  filings: '/(tabs)/disclosures',
};

export function isQuickActionId(value: string): value is QuickActionId {
  return QUICK_ACTION_IDS.includes(value as QuickActionId);
}

export function quickActionHref(action: QuickActions.Action): Href | null {
  if (typeof action.id === 'string' && isQuickActionId(action.id)) {
    return QUICK_ACTION_HREFS[action.id];
  }
  return null;
}

function quickActionTitle(locale: AppLocale, id: QuickActionId): string {
  const titleById: Record<QuickActionId, MessageId> = {
    market: 'tabSignal',
    board: 'screenBoard',
    youtube: 'tabYoutube',
    filings: 'tabDisclosures',
  };
  return messages[locale][titleById[id]];
}

export async function syncAppQuickActions(locale: AppLocale): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await QuickActions.isSupported())) return;

  await QuickActions.setItems(
    QUICK_ACTION_IDS.map((id) => ({
      id,
      title: quickActionTitle(locale, id),
      icon: Platform.select({
        ios:
          id === 'market'
            ? 'symbol:chart.line.uptrend.xyaxis'
            : id === 'board'
              ? 'symbol:text.bubble'
              : id === 'youtube'
                ? 'symbol:play.rectangle'
                : 'symbol:doc.text',
      }),
    })),
  );
}

let pendingQuickAction: QuickActions.Action | null = null;

export function stashPendingQuickAction(action: QuickActions.Action): void {
  pendingQuickAction = action;
}

export function takePendingQuickAction(): QuickActions.Action | null {
  const action = pendingQuickAction;
  pendingQuickAction = null;
  return action;
}
