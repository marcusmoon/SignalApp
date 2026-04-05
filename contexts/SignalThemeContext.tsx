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
  DEFAULT_CUSTOM_ACCENT_HEX,
  getThemeForPreset,
  loadAccentPreset,
  loadCustomAccentHex,
  saveAccentPreset,
  saveCustomAccentHex,
  normalizeHex,
} from '@/services/accentPreference';

type SignalThemeContextValue = {
  presetId: AccentPresetId;
  /** 커스텀 모드일 때 적용 중인 HEX (항상 최신 저장값 기준) */
  customHex: string;
  theme: AppTheme;
  setPresetId: (id: AccentPresetId) => Promise<void>;
  /** 커스텀 액센트 적용 + 프리셋을 `custom`으로 저장 */
  setCustomAccent: (hex: string) => Promise<void>;
};

const SignalThemeContext = createContext<SignalThemeContextValue | null>(null);

export function SignalThemeProvider({ children }: { children: ReactNode }) {
  const [presetId, setPresetIdState] = useState<AccentPresetId>('green');
  const [customHex, setCustomHex] = useState<string>(DEFAULT_CUSTOM_ACCENT_HEX);

  useEffect(() => {
    void (async () => {
      const [id, hex] = await Promise.all([loadAccentPreset(), loadCustomAccentHex()]);
      setPresetIdState(id);
      setCustomHex(hex);
    })();
  }, []);

  const theme = useMemo(() => getThemeForPreset(presetId, customHex), [presetId, customHex]);

  const setPresetId = useCallback(async (id: AccentPresetId) => {
    await saveAccentPreset(id);
    setPresetIdState(id);
  }, []);

  const setCustomAccent = useCallback(async (hex: string) => {
    const n = normalizeHex(hex) ?? DEFAULT_CUSTOM_ACCENT_HEX;
    await saveCustomAccentHex(n);
    await saveAccentPreset('custom');
    setCustomHex(n);
    setPresetIdState('custom');
  }, []);

  const value = useMemo<SignalThemeContextValue>(
    () => ({ presetId, customHex, theme, setPresetId, setCustomAccent }),
    [presetId, customHex, theme, setPresetId, setCustomAccent],
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
