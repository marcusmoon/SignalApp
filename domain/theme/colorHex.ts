import { CANONICAL_CUSTOM_ACCENT_FALLBACK } from './constants';

export function normalizeHex(input: string | null | undefined): string | null {
  if (input == null || typeof input !== 'string') return null;
  const s = input.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(s)) return null;
  const hex = s.startsWith('#') ? s : `#${s}`;
  return hex.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex) ?? CANONICAL_CUSTOM_ACCENT_FALLBACK;
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}
