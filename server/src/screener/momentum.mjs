/**
 * Momentum / trend metrics from daily bars (oldest → newest).
 * Returns are ratios (0.08 = +8%). Failures stay null — never invent 0.
 */

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10_000) / 10_000;
}

/** Trading-day lookbacks (approx calendar months). */
export const MOMENTUM_LOOKBACK = {
  return3m: 63,
  return6m: 126,
  return12m: 252,
  ma20: 20,
  ma60: 60,
  ma120: 120,
  ma200: 200,
  high52w: 252,
  volumeAvg: 20,
};

/**
 * Normalize bars to { close, high, volume } ascending by date when possible.
 * @param {object[]} bars
 */
export function normalizeMomentumBars(bars) {
  const list = Array.isArray(bars) ? bars : [];
  const rows = [];
  for (const bar of list) {
    const close = num(bar?.c ?? bar?.close ?? bar?.Close);
    if (close == null) continue;
    rows.push({
      date: String(bar?.date || bar?.d || '').trim() || null,
      close,
      high: num(bar?.h ?? bar?.high ?? bar?.High) ?? close,
      volume: num(bar?.v ?? bar?.volume ?? bar?.Volume),
    });
  }
  if (rows.some((r) => r.date)) {
    rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }
  return rows;
}

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) {
    sum += values[i];
  }
  return sum / period;
}

function returnOver(closes, lookback) {
  if (!Array.isArray(closes) || closes.length < lookback + 1) return null;
  const now = closes[closes.length - 1];
  const past = closes[closes.length - 1 - lookback];
  if (now == null || past == null || past === 0) return null;
  return round4(now / past - 1);
}

/**
 * @param {object[]} bars daily bars (or close arrays via normalize)
 * @returns {object} momentum slot fields (null when not computable)
 */
export function computeMomentumMetrics(bars) {
  const rows = normalizeMomentumBars(bars);
  const empty = {
    return3m: null,
    return6m: null,
    return12m: null,
    ma20: null,
    ma60: null,
    ma120: null,
    ma200: null,
    alignedMa: null,
    pctFrom52wHigh: null,
    volumeRatio: null,
  };
  if (rows.length < 2) return empty;

  const closes = rows.map((r) => r.close);
  const highs = rows.map((r) => r.high);
  const lastClose = closes[closes.length - 1];

  const ma20 = round4(sma(closes, MOMENTUM_LOOKBACK.ma20));
  const ma60 = round4(sma(closes, MOMENTUM_LOOKBACK.ma60));
  const ma120 = round4(sma(closes, MOMENTUM_LOOKBACK.ma120));
  const ma200 = round4(sma(closes, MOMENTUM_LOOKBACK.ma200));

  let alignedMa = null;
  if (ma20 != null && ma60 != null && ma120 != null && ma200 != null) {
    alignedMa = ma20 > ma60 && ma60 > ma120 && ma120 > ma200;
  }

  let pctFrom52wHigh = null;
  if (highs.length >= Math.min(MOMENTUM_LOOKBACK.high52w, 20)) {
    const window = highs.slice(-MOMENTUM_LOOKBACK.high52w);
    const hi = Math.max(...window);
    if (Number.isFinite(hi) && hi > 0 && lastClose != null) {
      pctFrom52wHigh = round4(lastClose / hi - 1);
    }
  }

  let volumeRatio = null;
  const volumes = rows.map((r) => r.volume).filter((v) => v != null && v > 0);
  if (volumes.length >= MOMENTUM_LOOKBACK.volumeAvg + 1) {
    const lastVol = volumes[volumes.length - 1];
    const avgWindow = volumes.slice(-(MOMENTUM_LOOKBACK.volumeAvg + 1), -1);
    const avg =
      avgWindow.reduce((sum, v) => sum + v, 0) / MOMENTUM_LOOKBACK.volumeAvg;
    if (avg > 0) volumeRatio = round4(lastVol / avg);
  }

  return {
    return3m: returnOver(closes, MOMENTUM_LOOKBACK.return3m),
    return6m: returnOver(closes, MOMENTUM_LOOKBACK.return6m),
    return12m: returnOver(closes, MOMENTUM_LOOKBACK.return12m),
    ma20,
    ma60,
    ma120,
    ma200,
    alignedMa,
    pctFrom52wHigh,
    volumeRatio,
  };
}
