/**
 * 네이티브 스플래시 PNG 생성 — SignalHeader 4-bar + SIGNAL 워드마크.
 * 실행: npm run generate:splash
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets/images');
const SPLASH_ICON_PATH = path.join(OUT_DIR, 'splash-icon.png');
const SPLASH_DARK_PATH = path.join(OUT_DIR, 'splash.png');

/** iPhone 기준 세로 스플래시 캔버스 */
const W = 1284;
const H = 2778;

const BRAND = '#3182F6';
const DARK_BG = '#090A0F';
const LIGHT_BG = '#F7F8FA';

const BAR_WIDTH = 8;
const BAR_GAP = 3;
const BAR_HEIGHTS = [12, 19, 26, 33];
const BAR_OPACITIES = [0.38, 0.58, 0.78, 1];
const WORDMARK_SIZE = 52;
const WORDMARK_TRACKING = 10;

function simplifiedBrandSvg(accent, wordmarkColor) {
  const barsW = BAR_WIDTH * 4 + BAR_GAP * 3;
  const blockW = Math.max(barsW, 220);
  let x = (blockW - barsW) / 2;
  const barRects = BAR_HEIGHTS.map((height, i) => {
    const el = `<rect x="${x}" y="${33 - height}" width="${BAR_WIDTH}" height="${height}" rx="4" fill="${accent}" opacity="${BAR_OPACITIES[i]}"/>`;
    x += BAR_WIDTH + BAR_GAP;
    return el;
  }).join('\n  ');
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${blockW}" height="120" xmlns="http://www.w3.org/2000/svg">
  ${barRects}
  <text
    x="${blockW / 2}"
    y="88"
    text-anchor="middle"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-weight="900"
    font-size="${WORDMARK_SIZE}"
    fill="${wordmarkColor}"
    letter-spacing="${WORDMARK_TRACKING}"
  >SIGNAL</text>
</svg>`);
}

async function renderSplash({ bg, accent, wordmarkColor, outPath, iconSize }) {
  const brandSvg = simplifiedBrandSvg(accent, wordmarkColor);
  const brandBuf = await sharp(brandSvg).png().toBuffer();
  const brandMeta = await sharp(brandBuf).metadata();
  const brandW = brandMeta.width || 220;
  const brandH = brandMeta.height || 120;

  if (iconSize) {
    await sharp(brandBuf)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    return;
  }

  const left = Math.round((W - brandW) / 2);
  const top = Math.round(H * 0.42 - brandH / 2);

  await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: brandBuf, left, top }])
    .png()
    .toFile(outPath);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await renderSplash({
    bg: DARK_BG,
    accent: BRAND,
    wordmarkColor: BRAND,
    outPath: SPLASH_DARK_PATH,
  });

  await renderSplash({
    bg: LIGHT_BG,
    accent: BRAND,
    wordmarkColor: BRAND,
    outPath: path.join(OUT_DIR, 'splash-light.png'),
  });

  await renderSplash({
    bg: DARK_BG,
    accent: BRAND,
    wordmarkColor: BRAND,
    outPath: SPLASH_ICON_PATH,
    iconSize: 512,
  });

  console.log('Wrote', SPLASH_DARK_PATH);
  console.log('Wrote', path.join(OUT_DIR, 'splash-light.png'));
  console.log('Wrote', SPLASH_ICON_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
