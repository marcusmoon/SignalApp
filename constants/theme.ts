export type ThemeColorScheme = 'light' | 'dark';

/** SIGNAL brand tokens — Toss-inspired light system. */
export const SIGNAL_LIGHT = {
  green: '#3182F6',
  greenDim: '#EAF3FF',
  greenBorder: '#D6E9FF',
  bg: '#F7F8FA',
  bgElevated: '#F2F4F6',
  card: '#FFFFFF',
  border: '#E5E8EB',
  text: '#191F28',
  textMuted: '#6B7684',
  textDim: '#8B95A1',
  accentBlue: '#3182F6',
  accentOrange: '#F59F00',
  danger: '#F04452',
  dangerDim: '#FFF0F1',
  warning: '#F59F00',
  warningDim: '#FFF7E6',
  colorScheme: 'light' as const,
} as const;

/** SIGNAL brand tokens — dark counterpart for the same semantic roles. */
export const SIGNAL_DARK = {
  green: '#3182F6',
  greenDim: '#112A4D',
  greenBorder: '#1F4E86',
  bg: '#090A0F',
  bgElevated: '#11131A',
  card: '#151821',
  border: '#2A2E3A',
  text: '#F2F4F6',
  textMuted: '#8B95A1',
  textDim: '#6B7684',
  accentBlue: '#3182F6',
  accentOrange: '#FFB020',
  danger: '#FF6B7A',
  dangerDim: '#34181D',
  warning: '#FFB020',
  warningDim: '#33250D',
  colorScheme: 'dark' as const,
} as const;

export const SIGNAL = SIGNAL_LIGHT;

/** Runtime theme: fixed semantic tokens. Accent arguments are kept for preference API compatibility. */
export function buildAppTheme(_accentHex: string, scheme: ThemeColorScheme = 'light') {
  const base = scheme === 'dark' ? SIGNAL_DARK : SIGNAL_LIGHT;
  return {
    ...base,
  };
}

export type AppTheme = ReturnType<typeof buildAppTheme>;

/** SignalThemeProvider 이전(폰트·엔드포인트 로딩) — 시스템 라이트/다크만 반영 */
export function bootstrapThemeForColorScheme(scheme: 'light' | 'dark' | null | undefined): AppTheme {
  return scheme === 'dark' ? { ...SIGNAL_DARK } : { ...SIGNAL_LIGHT };
}
