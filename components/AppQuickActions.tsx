import * as QuickActions from 'expo-quick-actions';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';

import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import {
  quickActionHref,
  stashPendingQuickAction,
  syncAppQuickActions,
  takePendingQuickAction,
} from '@/services/quickActions';

/** 홈 화면 아이콘 길게 누르기 Quick Actions 등록 및 딥링크 라우팅 */
export function AppQuickActions() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navReady = Boolean(rootNavigationState?.key);
  const { locale } = useLocale();
  const { isAvailable: isIpadSidebar, showTabs } = useIpadSidebarNav();
  const handledInitialRef = useRef(false);

  const flushPending = useCallback(() => {
    if (!navReady) return;
    const action = takePendingQuickAction();
    if (!action) return;

    const href = quickActionHref(action);
    if (!href) return;

    if (isIpadSidebar) {
      showTabs();
    }
    router.navigate(href);
  }, [navReady, router, isIpadSidebar, showTabs]);

  const enqueue = useCallback(
    (action: QuickActions.Action, coldStart = false) => {
      stashPendingQuickAction(action);
      const delayMs = coldStart ? 500 : 150;
      InteractionManager.runAfterInteractions(() => {
        setTimeout(flushPending, delayMs);
      });
    },
    [flushPending],
  );

  useEffect(() => {
    void syncAppQuickActions(locale);
  }, [locale]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const initial = QuickActions.initial;
    if (initial && !handledInitialRef.current) {
      handledInitialRef.current = true;
      enqueue(initial, true);
    }

    const sub = QuickActions.addListener((event) => {
      enqueue(event);
    });
    return () => sub.remove();
  }, [enqueue]);

  useEffect(() => {
    if (!navReady) return;
    flushPending();
  }, [navReady, flushPending]);

  return null;
}
