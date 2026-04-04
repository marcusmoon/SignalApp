import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { formatMessage, messages, type AppLocale, type MessageId } from '@/locales/messages';
import { loadLocale, saveLocale } from '@/services/localePreference';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => Promise<void>;
  t: (id: MessageId, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ko');

  useEffect(() => {
    void loadLocale().then(setLocaleState);
  }, []);

  const setLocale = useCallback(async (next: AppLocale) => {
    await saveLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (id: MessageId, vars?: Record<string, string | number>) => {
      const raw = messages[locale][id];
      return formatMessage(raw, vars);
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
