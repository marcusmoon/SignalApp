// Pure technical-factor math over a daily OHLCV bar series.
// No I/O here so the same functions can power live signals and (later) backtests.

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function closeSeries(bars = []) {
  return bars
    .map((bar) => finiteNumber(bar?.adjClose ?? bar?.close))
    .filter((value) => value != null);
}

export function volumeSeries(bars = []) {
  return bars.map((bar) => finiteNumber(bar?.volume)).filter((value) => value != null);
}

export function simpleMovingAverage(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i += 1) sum += values[i];
  return sum / period;
}

export function returnOverDays(values, days) {
  if (!Array.isArray(values) || values.length <= days || days <= 0) return null;
  const last = values[values.length - 1];
  const past = values[values.length - 1 - days];
  if (past == null || past === 0) return null;
  return ((last - past) / past) * 100;
}

// Wilder's RSI over `period` closes.
export function relativeStrengthIndex(values, period = 14) {
  if (!Array.isArray(values) || values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Annualized volatility (%) from daily log-ish returns over the trailing window.
export function annualizedVolatility(values, window = 20) {
  if (!Array.isArray(values) || values.length <= window) return null;
  const returns = [];
  for (let i = values.length - window; i < values.length; i += 1) {
    const prev = values[i - 1];
    if (prev == null || prev === 0) continue;
    returns.push((values[i] - prev) / prev);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function trailingExtreme(values, window, kind) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const slice = window > 0 ? values.slice(Math.max(0, values.length - window)) : values;
  if (slice.length === 0) return null;
  return kind === 'max' ? Math.max(...slice) : Math.min(...slice);
}

// Computes the full indicator set for one bar series. Missing inputs return null
// rather than throwing, so short histories degrade gracefully.
export function computeFactors(bars = []) {
  const closes = closeSeries(bars);
  const volumes = volumeSeries(bars);
  const lastClose = closes.length ? closes[closes.length - 1] : null;

  const sma20 = simpleMovingAverage(closes, 20);
  const sma60 = simpleMovingAverage(closes, 60);
  const sma120 = simpleMovingAverage(closes, 120);

  const vsSma20Pct = sma20 != null && lastClose != null ? ((lastClose - sma20) / sma20) * 100 : null;
  const vsSma60Pct = sma60 != null && lastClose != null ? ((lastClose - sma60) / sma60) * 100 : null;
  const sma20VsSma60Pct = sma20 != null && sma60 != null ? ((sma20 - sma60) / sma60) * 100 : null;

  const return5d = returnOverDays(closes, 5);
  const return20d = returnOverDays(closes, 20);
  const return60d = returnOverDays(closes, 60);
  const return120d = returnOverDays(closes, 120);

  const rsi14 = relativeStrengthIndex(closes, 14);
  const volatility = annualizedVolatility(closes, 20);

  const high52w = trailingExtreme(closes, 252, 'max');
  const low52w = trailingExtreme(closes, 252, 'min');
  const vsHigh52wPct = high52w != null && lastClose != null ? ((lastClose - high52w) / high52w) * 100 : null;
  const vsLow52wPct = low52w != null && lastClose != null && low52w !== 0 ? ((lastClose - low52w) / low52w) * 100 : null;

  const avgVolume20 = simpleMovingAverage(volumes, 20);
  const lastVolume = volumes.length ? volumes[volumes.length - 1] : null;
  const volumeRatio = avgVolume20 != null && avgVolume20 !== 0 && lastVolume != null ? lastVolume / avgVolume20 : null;

  return {
    barCount: bars.length,
    lastClose,
    sma20,
    sma60,
    sma120,
    vsSma20Pct,
    vsSma60Pct,
    sma20VsSma60Pct,
    return5d,
    return20d,
    return60d,
    return120d,
    rsi14,
    volatility,
    high52w,
    low52w,
    vsHigh52wPct,
    vsLow52wPct,
    avgVolume20,
    lastVolume,
    volumeRatio,
  };
}

export function roundOrNull(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}
