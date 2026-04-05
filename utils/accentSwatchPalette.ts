/**
 * 커스텀 액센트용 HEX 팔레트.
 * 흰·빨·주·노·초·파·남·보 8열, 각 열은 위→아래 명도 그라데이션 10단계(위가 밝고 아래로 어두움).
 * 격자는 행 우선(행=명도 스텝, 열=고정 색조).
 * `services/accentPreference`를 import하지 않아 require 순환을 피한다.
 */

export const ACCENT_PALETTE_COLS = 8;
export const ACCENT_PALETTE_ROWS = 10;

/** 열 인덱스 1..7: 빨·주·노·초·파·남·보 (도). 열 0은 무채(흰/회색 계열). */
const CHROMATIC_HUES_DEG = [0, 30, 55, 135, 218, 258, 305] as const;

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

/** HSL(도, 0–1, 0–1) → RGB */
function hslToRgb(hDeg: number, s: number, l: number): { r: number; g: number; b: number } {
  const h = ((((hDeg % 360) + 360) % 360) / 360);
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * 흰(무채) + 빨주노초파남보 7색, 열마다 동일 색조·채도에서 명도만 10단계.
 */
export function buildRainbowKoreanAccentPalette(): string[] {
  const out: string[] = [];
  const chromaS = 0.88;

  for (let r = 0; r < ACCENT_PALETTE_ROWS; r++) {
    const t = ACCENT_PALETTE_ROWS <= 1 ? 0.5 : r / (ACCENT_PALETTE_ROWS - 1);
    const lightness = 0.1 + 0.82 * (1 - t);

    for (let c = 0; c < ACCENT_PALETTE_COLS; c++) {
      if (c === 0) {
        const { r: rr, g, b } = hslToRgb(0, 0, lightness);
        out.push(rgbToHex(rr, g, b));
        continue;
      }
      const h = CHROMATIC_HUES_DEG[c - 1];
      const { r: rr, g, b } = hslToRgb(h, chromaS, lightness);
      out.push(rgbToHex(rr, g, b));
    }
  }

  return out;
}
