import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useWebThemeAppearanceMode } from '@/hooks/useWebThemeAppearanceMode';

import type { AppTheme, ThemeColorScheme } from '@/constants/theme';
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
  type FeedContentTypography,
  type FeedContentWeightId,
  feedContentTypography,
  loadFeedContentWeight,
  saveFeedContentWeight,
} from '@/services/feedContentWeightPreference';
import {
  type FontSizePresetId,
  fontSizeMultiplierForPreset,
  loadFontSizePreset,
  saveFontSizePreset,
} from '@/services/fontSizePreference';
import {
  loadThemeAppearanceMode,
  readEffectiveColorSchemeSync,
  readThemeAppearanceModeSync,
  saveThemeAppearanceMode,
  type ThemeAppearanceMode,
} from '@/services/themeAppearancePreference';
import { applyWebDocumentTheme } from '@/utils/webThemeDocument';

type SignalThemeContextValue = {
  appearanceMode: ThemeAppearanceMode;
  effectiveColorScheme: ThemeColorScheme;
  setAppearanceMode: (mode: ThemeAppearanceMode) => Promise<void>;
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
  /** 홈·시세·유튜브 피드 항목 굵기·행 여백 */
  feedContentWeight: FeedContentWeightId;
  setFeedContentWeight: (id: FeedContentWeightId) => Promise<void>;
  feedTypo: FeedContentTypography;
  /** StyleSheet `fontSize` 등에 곱해 일관된 스케일 적용 */
  scaleFont: (px: number) => number;
};

const SignalThemeContext = createContext<SignalThemeContextValue | null>(null);

export function SignalThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const webAppearanceMode = useWebThemeAppearanceMode();
  const [appearanceMode, setAppearanceModeState] = useState<ThemeAppearanceMode>(() =>
    Platform.OS === 'web' ? readThemeAppearanceModeSync() : 'system',
  );
  const resolvedAppearanceMode = Platform.OS === 'web' ? webAppearanceMode : appearanceMode;
  const [presetId, setPresetIdState] = useState<AccentPresetId>('blue');
  const [customHex, setCustomHex] = useState<string>(DEFAULT_CUSTOM_ACCENT_HEX);
  const [fontSizePreset, setFontSizePresetState] = useState<FontSizePresetId>('standard');
  const [feedContentWeight, setFeedContentWeightState] = useState<FeedContentWeightId>('bold');

  useEffect(() => {
    void (async () => {
      const [mode, id, hex, fontId, feedWeight] = await Promise.all([
        loadThemeAppearanceMode(),
        loadAccentPreset(),
        loadCustomAccentHex(),
        loadFontSizePreset(),
        loadFeedContentWeight(),
      ]);
      if (Platform.OS !== 'web') {
        setAppearanceModeState((current) => (current === mode ? current : mode));
      }
      setPresetIdState(id);
      setCustomHex(hex);
      setFontSizePresetState(fontId);
      setFeedContentWeightState(feedWeight);
    })();
  }, []);

  const effectiveColorScheme = useMemo<ThemeColorScheme>(() => {
    if (resolvedAppearanceMode === 'dark') return 'dark';
    if (resolvedAppearanceMode === 'light') return 'light';
    if (Platform.OS === 'web') {
      return readEffectiveColorSchemeSync();
    }
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }, [resolvedAppearanceMode, systemColorScheme]);

  const theme = useMemo(
    () => getThemeForPreset(presetId, customHex, effectiveColorScheme),
    [presetId, customHex, effectiveColorScheme],
  );

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    applyWebDocumentTheme(effectiveColorScheme, theme.bg, theme);
  }, [effectiveColorScheme, theme]);

  const fontMultiplier = useMemo(() => fontSizeMultiplierForPreset(fontSizePreset), [fontSizePreset]);

  const scaleFont = useCallback(
    (px: number) => {
      const n = px * fontMultiplier;
      return Math.max(8, Math.round(n * 10) / 10);
    },
    [fontMultiplier],
  );

  const feedTypo = useMemo(
    () => feedContentTypography(feedContentWeight, scaleFont),
    [feedContentWeight, scaleFont],
  );

  const setPresetId = useCallback(async (id: AccentPresetId) => {
    await saveAccentPreset(id);
    setPresetIdState(id);
  }, []);

  const setAppearanceMode = useCallback(async (mode: ThemeAppearanceMode) => {
    await saveThemeAppearanceMode(mode);
    setAppearanceModeState(mode);
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

  const setFeedContentWeight = useCallback(async (id: FeedContentWeightId) => {
    await saveFeedContentWeight(id);
    setFeedContentWeightState(id);
  }, []);

  const value = useMemo<SignalThemeContextValue>(
    () => ({
      presetId,
      appearanceMode: resolvedAppearanceMode,
      effectiveColorScheme,
      setAppearanceMode,
      customHex,
      theme,
      setPresetId,
      setCustomAccent,
      fontSizePreset,
      setFontSizePreset,
      feedContentWeight,
      setFeedContentWeight,
      feedTypo,
      scaleFont,
    }),
    [
      presetId,
      resolvedAppearanceMode,
      effectiveColorScheme,
      setAppearanceMode,
      customHex,
      theme,
      setPresetId,
      setCustomAccent,
      fontSizePreset,
      setFontSizePreset,
      feedContentWeight,
      setFeedContentWeight,
      feedTypo,
      scaleFont,
    ],
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
