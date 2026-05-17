/**
 * 네이티브 스플래시 PNG 생성 (아이콘 + SIGNAL 워드마크, 하단 광고 슬롯 여백).
 * 실행: npm run generate:splash
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT, 'assets/images/splash.png');
const ICON_PATH = path.join(ROOT, 'assets/images/splash-icon.png');

/** iPhone 기준 세로 스플래시 캔버스 (Expo 권장 해상도대) */
const W = 1284;
const H = 2778;
const BG = '#0A0A0F';
/** 브랜드 워드마크 — 다국어 없이 고정 "SIGNAL" */
const WORDMARK = 'SIGNAL';
const WORDMARK_COLOR = '#03B26C';
/** 하단 광고·배너용 여백 (캔버스 비율) */
const AD_SLOT_BOTTOM_RATIO = 0.28;

const ICON_BOX = 200;
const WORDMARK_SIZE = 52;
const WORDMARK_TRACKING = 10;
const GAP_ICON_WORDMARK = 28;

async function main() {
  if (!fs.existsSync(ICON_PATH)) {
    console.error('Missing', ICON_PATH);
    process.exit(1);
  }

  const brandZoneH = H * (1 - AD_SLOT_BOTTOM_RATIO);
  const blockCenterY = brandZoneH * 0.5;
  const iconTop = Math.round(blockCenterY - ICON_BOX / 2 - GAP_ICON_WORDMARK / 2 - WORDMARK_SIZE / 2);
  const wordmarkY = iconTop + ICON_BOX + GAP_ICON_WORDMARK + WORDMARK_SIZE * 0.82;

  const iconBuf = await sharp(ICON_PATH)
    .resize(ICON_BOX, ICON_BOX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const iconLeft = Math.round((W - ICON_BOX) / 2);

  const overlaySvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="${W / 2}"
    y="${wordmarkY}"
    text-anchor="middle"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-weight="900"
    font-size="${WORDMARK_SIZE}"
    fill="${WORDMARK_COLOR}"
    letter-spacing="${WORDMARK_TRACKING}"
  >${WORDMARK}</text>
</svg>`);

  await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      { input: iconBuf, left: iconLeft, top: iconTop },
      { input: overlaySvg, top: 0, left: 0 },
    ])
    .png()
    .toFile(OUT_PATH);

  console.log('Wrote', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
