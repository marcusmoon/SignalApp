/** SIGNAL brand tokens (PRD) */
export const SIGNAL = {
  green: '#00C087',
  greenDim: '#00C08718',
  greenBorder: '#00C08730',
  bg: '#0A0A0F',
  bgElevated: '#0D0D16',
  card: '#111118',
  border: '#1E1E2A',
  text: '#E0E0F0',
  textMuted: '#888888',
  textDim: '#555555',
  accentBlue: '#4D9FFF',
  accentOrange: '#FF8C00',
} as const;

/** Runtime theme: same shape as SIGNAL; `green*` follow user accent preset. */
export function buildAppTheme(accentHex: string) {
  return {
    ...SIGNAL,
    green: accentHex,
    greenDim: `${accentHex}18`,
    greenBorder: `${accentHex}30`,
  };
}

export type AppTheme = ReturnType<typeof buildAppTheme>;
