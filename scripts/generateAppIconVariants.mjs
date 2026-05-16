import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const sourcePath = path.resolve('assets/images/splash-icon.png');
const outDir = path.resolve('assets/images');

const variants = [
  { id: 'green', accent: '#03B26C' },
  { id: 'blue', accent: '#3182F6' },
  { id: 'dark', accent: '#4D9FFF' },
  { id: 'mono', accent: '#F2F4F6' },
];

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function clamp(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(a, b, t) {
  return clamp(a + (b - a) * t);
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pulseMask(r, g, b) {
  const greenDominance = Math.max(0, g - Math.max(r, b));
  const brightness = luminance(r, g, b);
  return Math.min(1, Math.max(0, greenDominance / 135 + (brightness - 105) / 230));
}

function glowMask(r, g, b) {
  const greenBias = Math.max(0, g - r * 0.72 - b * 0.72);
  return Math.min(1, Math.max(0, greenBias / 155));
}

function recolorPixel(r, g, b, accent) {
  const pulse = pulseMask(r, g, b);
  const glow = glowMask(r, g, b);
  const lum = luminance(r, g, b);

  if (pulse > 0.16) {
    const highlight = Math.max(0, (lum - 140) / 115) * 0.22;
    return {
      r: mix(accent.r, 255, highlight),
      g: mix(accent.g, 255, highlight),
      b: mix(accent.b, 255, highlight),
    };
  }

  if (glow > 0.08) {
    const t = glow * 0.32;
    return {
      r: mix(r, accent.r, t),
      g: mix(g, accent.g, t),
      b: mix(b, accent.b, t),
    };
  }

  return { r, g, b };
}

function generate(variant) {
  const accent = hexToRgb(variant.accent);
  const input = PNG.sync.read(fs.readFileSync(sourcePath));
  const output = new PNG({ width: input.width, height: input.height });

  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const idx = (input.width * y + x) << 2;
      const next = recolorPixel(
        input.data[idx],
        input.data[idx + 1],
        input.data[idx + 2],
        accent,
      );
      output.data[idx] = next.r;
      output.data[idx + 1] = next.g;
      output.data[idx + 2] = next.b;
      output.data[idx + 3] = 255;
    }
  }

  fs.writeFileSync(
    path.join(outDir, `app-icon-${variant.id}.png`),
    PNG.sync.write(output, { colorType: 2, inputHasAlpha: true }),
  );
}

fs.mkdirSync(outDir, { recursive: true });
variants.forEach(generate);
