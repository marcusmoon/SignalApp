import type { ThemeColorScheme } from '@/constants/theme';

/** Repeat tile size (px) for web CSS background-repeat. */
export const THEME_BACKGROUND_PATTERN_TILE = 28;

const STEP = THEME_BACKGROUND_PATTERN_TILE;

function encodePatternSvg(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function dotColor(scheme: ThemeColorScheme): string {
  return scheme === 'dark' ? 'rgba(49,130,246,0.34)' : 'rgba(49,130,246,0.28)';
}

function gridLineColor(scheme: ThemeColorScheme): string {
  return scheme === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(49,130,246,0.08)';
}

/** Small tile for web CSS repeat — dot + faint grid lines. */
export function themeBackgroundPatternUri(scheme: ThemeColorScheme): string {
  const size = STEP;
  const half = size / 2;
  const dot = dotColor(scheme);
  const line = gridLineColor(scheme);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><line x1="0" y1="${size}" x2="${size}" y2="${size}" stroke="${line}" stroke-width="0.6"/><line x1="${size}" y1="0" x2="${size}" y2="${size}" stroke="${line}" stroke-width="0.6"/><circle cx="${half}" cy="${half}" r="1.2" fill="${dot}"/></svg>`;
  return encodePatternSvg(svg);
}

/** Dense grid for native cover (repeat is unreliable on RN Image). */
export function themeBackgroundPatternCoverUri(scheme: ThemeColorScheme): string {
  const grid = 14;
  const size = STEP * grid;
  const dot = dotColor(scheme);
  const line = gridLineColor(scheme);
  const parts: string[] = [];

  for (let index = 0; index <= grid; index += 1) {
    const pos = index * STEP;
    parts.push(`<line x1="${pos}" y1="0" x2="${pos}" y2="${size}" stroke="${line}" stroke-width="0.6"/>`);
    parts.push(`<line x1="0" y1="${pos}" x2="${size}" y2="${pos}" stroke="${line}" stroke-width="0.6"/>`);
  }

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const cx = col * STEP + STEP / 2;
      const cy = row * STEP + STEP / 2;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="1.2" fill="${dot}"/>`);
    }
  }

  return encodePatternSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${parts.join('')}</svg>`,
  );
}

export function themeBackgroundPatternCssValue(scheme: ThemeColorScheme): string {
  return `url("${themeBackgroundPatternUri(scheme)}")`;
}
