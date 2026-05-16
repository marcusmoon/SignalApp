/** SIGNAL brand tokens — light-first Toss-inspired system. */
export const SIGNAL = {
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
} as const;

/** Runtime theme: same shape as SIGNAL; `green*` follow user accent preset. */
export function buildAppTheme(accentHex: string) {
  return {
    ...SIGNAL,
    green: accentHex,
    greenDim: `${accentHex}12`,
    greenBorder: `${accentHex}26`,
  };
}

export type AppTheme = ReturnType<typeof buildAppTheme>;
