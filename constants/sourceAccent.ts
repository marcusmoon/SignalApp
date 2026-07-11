import type { AppTheme } from '@/constants/theme';

export type SourceAccent = {
  accent: string;
  dim: string;
  border: string;
  glyph: string;
  /** 파비콘 URL — 실패 시 glyph fallback */
  iconUrl?: string | null;
};

const FALLBACK_PALETTE = [
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 6) return null;
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function accentAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export function fallbackSourceAccent(label: string, theme: AppTheme): SourceAccent {
  const trimmed = label.trim();
  const glyph = (trimmed[0] || '?').toUpperCase();
  const accent = FALLBACK_PALETTE[hashString(trimmed.toLowerCase()) % FALLBACK_PALETTE.length];
  return {
    accent,
    dim: accentAlpha(accent, theme.colorScheme === 'dark' ? 0.22 : 0.12),
    border: accentAlpha(accent, theme.colorScheme === 'dark' ? 0.45 : 0.28),
    glyph,
  };
}
