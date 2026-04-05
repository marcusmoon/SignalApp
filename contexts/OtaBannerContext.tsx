import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { isPreviewOtaBannerEnabled } from '@/services/env';
import { checkOtaAvailable, fetchAndReloadOta } from '@/services/otaUpdates';

type OtaBannerContextValue = {
  visible: boolean;
  previewMode: boolean;
  loading: boolean;
  dismiss: () => void;
  apply: () => Promise<void>;
};

const OtaBannerContext = createContext<OtaBannerContextValue | null>(null);

export function OtaBannerProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  /** manifest extra + process.env (services/env) — 번들에만 박힌 env에만 의존하지 않음 */
  const previewMode = isPreviewOtaBannerEnabled();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const dismissed = useRef(false);

  /** preview 플래그·번들 갱신 시 visible 동기화 (Fast Refresh로 이전 true가 남는 것 방지) */
  useEffect(() => {
    if (previewMode) {
      if (!dismissed.current) setVisible(true);
    } else {
      setVisible(false);
      dismissed.current = false;
    }
  }, [previewMode]);

  const probe = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (previewMode) {
      if (!dismissed.current) setVisible(true);
      return;
    }
    if (__DEV__) return;
    if (dismissed.current) return;
    const ok = await checkOtaAvailable();
    if (dismissed.current) return;
    if (ok) setVisible(true);
  }, [previewMode]);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        dismissed.current = false;
        void probe();
      }
    });
    return () => sub.remove();
  }, [probe]);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    setVisible(false);
  }, []);

  const apply = useCallback(async () => {
    if (previewMode) {
      Alert.alert(t('otaUpdatePreviewTitle'), t('otaUpdatePreviewBody'));
      return;
    }
    setLoading(true);
    try {
      await fetchAndReloadOta();
    } catch {
      Alert.alert(t('otaUpdateErrorTitle'), t('otaUpdateErrorBody'));
    } finally {
      setLoading(false);
    }
  }, [previewMode, t]);

  const value = useMemo(
    () => ({
      visible,
      previewMode,
      loading,
      dismiss,
      apply,
    }),
    [visible, previewMode, loading, dismiss, apply],
  );

  return <OtaBannerContext.Provider value={value}>{children}</OtaBannerContext.Provider>;
}

export function useOtaBanner(): OtaBannerContextValue {
  const ctx = useContext(OtaBannerContext);
  if (!ctx) {
    throw new Error('useOtaBanner must be used within OtaBannerProvider');
  }
  return ctx;
}
