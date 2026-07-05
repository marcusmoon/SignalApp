import type { ThemeColorScheme } from '@/constants/theme';

/** Repeat tile size (px) — keep small so the grid stays subtle on phone screens. */
export const THEME_BACKGROUND_PATTERN_TILE = 28;

function encodePatternSvg(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Brand-tinted dot grid; opacity is baked into the SVG fill. */
export function themeBackgroundPatternUri(scheme: ThemeColorScheme): string {
  const size = THEME_BACKGROUND_PATTERN_TILE;
  const dot =
    scheme === 'dark' ? 'rgba(49,130,246,0.10)' : 'rgba(49,130,246,0.075)';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="0.85" fill="${dot}"/></svg>`;
  return encodePatternSvg(svg);
}

export function themeBackgroundPatternCssValue(scheme: ThemeColorScheme): string {
  return `url("${themeBackgroundPatternUri(scheme)}")`;
}
