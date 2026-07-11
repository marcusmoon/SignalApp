import type { AppTheme } from '@/constants/theme';
import { accentAlpha } from '@/constants/sourceAccent';

const SYMBOL_AVATAR_PALETTE = [
  '#E5484D',
  '#E5489D',
  '#8E4EC6',
  '#3E63DD',
  '#00A2C7',
  '#30A46C',
  '#F59F00',
  '#BD4C00',
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function symbolAvatarGlyph(symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  if (!sym || sym === '—' || sym === 'GLOBAL') return '?';
  if (/^\d{6}$/.test(sym)) return sym.slice(-2);
  if (sym.length <= 2) return sym;
  return sym.slice(0, 1);
}

export function symbolAvatarAccent(symbol: string, theme: AppTheme): string {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return theme.textMuted;
  return SYMBOL_AVATAR_PALETTE[hashString(sym) % SYMBOL_AVATAR_PALETTE.length];
}

export function symbolAvatarColors(symbol: string, theme: AppTheme) {
  const accent = symbolAvatarAccent(symbol, theme);
  return {
    accent,
    background: accentAlpha(accent, theme.colorScheme === 'dark' ? 0.24 : 0.14),
    border: accentAlpha(accent, theme.colorScheme === 'dark' ? 0.5 : 0.32),
    text: accent,
  };
}
