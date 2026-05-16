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
  green: '#4D9FFF',
  greenDim: '#163A5F',
  greenBorder: '#285B8F',
  bg: '#0A0A0F',
  bgElevated: '#12121A',
  card: '#181821',
  border: '#2A2A35',
  text: '#F2F4F6',
  textMuted: '#A7B0BE',
  textDim: '#707A89',
  accentBlue: '#4D9FFF',
  accentOrange: '#FFB020',
  danger: '#FF6B7A',
  dangerDim: '#34181D',
  warning: '#FFB020',
  warningDim: '#33250D',
  colorScheme: 'dark' as const,
} as const;

export const SIGNAL = SIGNAL_LIGHT;

function accentDimForScheme(accentHex: string, scheme: ThemeColorScheme) {
  return scheme === 'dark' ? `${accentHex}24` : `${accentHex}12`;
}

function accentBorderForScheme(accentHex: string, scheme: ThemeColorScheme) {
  return scheme === 'dark' ? `${accentHex}42` : `${accentHex}26`;
}

/** Runtime theme: same shape as SIGNAL; `green*` follow user accent preset. */
export function buildAppTheme(accentHex: string, scheme: ThemeColorScheme = 'light') {
  const base = scheme === 'dark' ? SIGNAL_DARK : SIGNAL_LIGHT;
  return {
    ...base,
    green: accentHex,
    greenDim: accentDimForScheme(accentHex, scheme),
    greenBorder: accentBorderForScheme(accentHex, scheme),
  };
}

export type AppTheme = ReturnType<typeof buildAppTheme>;
