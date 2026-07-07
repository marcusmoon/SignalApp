import { useFocusEffect } from 'expo-router/react-navigation';
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

type WebHeaderRefreshContextValue = {
  registerRefresh: (handler: (() => void) | null) => void;
  triggerRefresh: () => void;
};

const WebHeaderRefreshContext = createContext<WebHeaderRefreshContextValue | null>(null);

/** iPad·넓은 웹 레이아웃 전역 `SignalHeader` 로고 탭 → 현재 탭 refresh */
export function WebHeaderRefreshProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null);

  const registerRefresh = useCallback((handler: (() => void) | null) => {
    handlerRef.current = handler;
  }, []);

  const triggerRefresh = useCallback(() => {
    handlerRef.current?.();
  }, []);

  return (
    <WebHeaderRefreshContext.Provider value={{ registerRefresh, triggerRefresh }}>
      {children}
    </WebHeaderRefreshContext.Provider>
  );
}

export function useWebHeaderRefreshTrigger(): () => void {
  const ctx = useContext(WebHeaderRefreshContext);
  return ctx?.triggerRefresh ?? (() => {});
}

type RegisterMode = 'focus' | 'mount';

/** 넓은 웹(`useTwoPane`)에서 포커스된 탭·홈 pane의 `onRefresh`를 전역 헤더에 연결한다. */
export function useRegisterWebHeaderRefresh(onRefresh: () => void, mode: RegisterMode = 'focus'): void {
  const ctx = useContext(WebHeaderRefreshContext);
  const { useTwoPane } = useResponsiveLayout();
  const enabled = Platform.OS === 'web' && useTwoPane;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (mode !== 'mount' || !enabled || !ctx) return;
    ctx.registerRefresh(() => {
      void onRefreshRef.current();
    });
    return () => ctx.registerRefresh(null);
  }, [ctx, enabled, mode]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'focus' || !enabled || !ctx) return;
      ctx.registerRefresh(() => {
        void onRefreshRef.current();
      });
      return () => ctx.registerRefresh(null);
    }, [ctx, enabled, mode]),
  );
}
