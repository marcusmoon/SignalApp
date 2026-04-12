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
import {
  type FontSizePresetId,
  fontSizeMultiplierForPreset,
  loadFontSizePreset,
  saveFontSizePreset,
} from '@/services/fontSizePreference';

type SignalThemeContextValue = {
  presetId: AccentPresetId;
  /** 커스텀 모드일 때 적용 중인 HEX (항상 최신 저장값 기준) */
  customHex: string;
  theme: AppTheme;
  setPresetId: (id: AccentPresetId) => Promise<void>;
  /** 커스텀 액센트 적용 + 프리셋을 `custom`으로 저장 */
  setCustomAccent: (hex: string) => Promise<void>;
  /** 표시 탭: 본문·브리핑 등 기준 글꼴 크기 */
  fontSizePreset: FontSizePresetId;
  setFontSizePreset: (id: FontSizePresetId) => Promise<void>;
  /** StyleSheet `fontSize` 등에 곱해 일관된 스케일 적용 */
  scaleFont: (px: number) => number;
};

const SignalThemeContext = createContext<SignalThemeContextValue | null>(null);

export function SignalThemeProvider({ children }: { children: ReactNode }) {
  const [presetId, setPresetIdState] = useState<AccentPresetId>('green');
  const [customHex, setCustomHex] = useState<string>(DEFAULT_CUSTOM_ACCENT_HEX);
  const [fontSizePreset, setFontSizePresetState] = useState<FontSizePresetId>('standard');

  useEffect(() => {
    void (async () => {
      const [id, hex, fontId] = await Promise.all([
        loadAccentPreset(),
        loadCustomAccentHex(),
        loadFontSizePreset(),
      ]);
      setPresetIdState(id);
      setCustomHex(hex);
      setFontSizePresetState(fontId);
    })();
  }, []);

  const theme = useMemo(() => getThemeForPreset(presetId, customHex), [presetId, customHex]);

  const fontMultiplier = useMemo(() => fontSizeMultiplierForPreset(fontSizePreset), [fontSizePreset]);

  const scaleFont = useCallback(
    (px: number) => {
      const n = px * fontMultiplier;
      return Math.max(8, Math.round(n * 10) / 10);
    },
    [fontMultiplier],
  );

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

  const setFontSizePreset = useCallback(async (id: FontSizePresetId) => {
    await saveFontSizePreset(id);
    setFontSizePresetState(id);
  }, []);

  const value = useMemo<SignalThemeContextValue>(
    () => ({
      presetId,
      customHex,
      theme,
      setPresetId,
      setCustomAccent,
      fontSizePreset,
      setFontSizePreset,
      scaleFont,
    }),
    [presetId, customHex, theme, setPresetId, setCustomAccent, fontSizePreset, setFontSizePreset, scaleFont],
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
