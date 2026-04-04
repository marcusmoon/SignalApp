import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AppTheme } from '@/constants/theme';
import {
  type AccentPresetId,
  getThemeForPreset,
  loadAccentPreset,
  saveAccentPreset,
} from '@/services/accentPreference';

type SignalThemeContextValue = {
  presetId: AccentPresetId;
  theme: AppTheme;
  setPresetId: (id: AccentPresetId) => Promise<void>;
};

const SignalThemeContext = createContext<SignalThemeContextValue | null>(null);

export function SignalThemeProvider({ children }: { children: ReactNode }) {
  const [presetId, setPresetIdState] = useState<AccentPresetId>('green');

  useEffect(() => {
    void loadAccentPreset().then(setPresetIdState);
  }, []);

  const theme = useMemo(() => getThemeForPreset(presetId), [presetId]);

  const setPresetId = useCallback(async (id: AccentPresetId) => {
    await saveAccentPreset(id);
    setPresetIdState(id);
  }, []);

  const value = useMemo<SignalThemeContextValue>(
    () => ({ presetId, theme, setPresetId }),
    [presetId, theme, setPresetId],
  );

  return <SignalThemeContext.Provider value={value}>{children}</SignalThemeContext.Provider>;
}

export function useSignalTheme(): SignalThemeContextValue {
  const ctx = useContext(SignalThemeContext);
  if (!ctx) {
    throw new Error('useSignalTheme must be used within SignalThemeProvider');
  }
  return ctx;
}
