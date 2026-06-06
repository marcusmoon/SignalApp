import { computeFactors, roundOrNull } from './factors.mjs';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function addReason(out, code) {
  if (!code || out.includes(code)) return;
  out.push(code);
}

// Each sub-score is centered at 50 (neutral) and bounded to [0, 100] so the
// composite stays interpretable and no single factor can dominate.
function trendScore(factors, reasons) {
  let score = 50;
  if (factors.vsSma20Pct != null) score += clamp(factors.vsSma20Pct * 1.6, -22, 22);
  if (factors.vsSma60Pct != null) score += clamp(factors.vsSma60Pct * 1.1, -18, 18);
  if (factors.sma20VsSma60Pct != null) score += clamp(factors.sma20VsSma60Pct * 2.0, -12, 12);

  if (factors.vsSma20Pct != null && factors.vsSma60Pct != null) {
    if (factors.vsSma20Pct > 0 && factors.vsSma60Pct > 0) addReason(reasons, 'trend_up');
    else if (factors.vsSma20Pct < 0 && factors.vsSma60Pct < 0) addReason(reasons, 'trend_down');
  }
  if (factors.sma20VsSma60Pct != null) {
    if (factors.sma20VsSma60Pct >= 1) addReason(reasons, 'golden_cross_zone');
    else if (factors.sma20VsSma60Pct <= -1) addReason(reasons, 'dead_cross_zone');
  }
  return clamp(Math.round(score), 0, 100);
}

function momentumScore(factors, reasons) {
  let score = 50;
  if (factors.return20d != null) score += clamp(factors.return20d * 1.4, -24, 24);
  if (factors.return60d != null) score += clamp(factors.return60d * 0.7, -18, 18);
  if (factors.return5d != null) score += clamp(factors.return5d * 0.8, -10, 10);

  if (factors.return20d != null && factors.return20d >= 8) addReason(reasons, 'momentum_strong');
  else if (factors.return20d != null && factors.return20d <= -8) addReason(reasons, 'momentum_weak');
  if (factors.vsHigh52wPct != null && factors.vsHigh52wPct >= -3) addReason(reasons, 'near_52w_high');
  if (factors.vsLow52wPct != null && factors.vsLow52wPct <= 5) addReason(reasons, 'near_52w_low');
  return clamp(Math.round(score), 0, 100);
}

// Contrarian overlay: rewards oversold mean-reversion candidates and trims
// overbought chases. Centered at 50.
function meanReversionScore(factors, reasons) {
  const rsi = factors.rsi14;
  if (rsi == null) return 50;
  let score = 50;
  if (rsi >= 75) {
    score -= 22;
    addReason(reasons, 'overbought');
  } else if (rsi >= 68) {
    score -= 12;
    addReason(reasons, 'overbought_mild');
  } else if (rsi <= 25) {
    score += 20;
    addReason(reasons, 'oversold');
  } else if (rsi <= 32) {
    score += 10;
    addReason(reasons, 'oversold_mild');
  }
  return clamp(Math.round(score), 0, 100);
}

function volumeScore(factors, reasons) {
  const ratio = factors.volumeRatio;
  if (ratio == null) return 50;
  let score = 50;
  if (ratio >= 2) {
    score += 16;
    addReason(reasons, 'volume_spike');
  } else if (ratio >= 1.3) {
    score += 8;
    addReason(reasons, 'volume_active');
  } else if (ratio <= 0.6) {
    score -= 8;
    addReason(reasons, 'volume_dry');
  }
  return clamp(Math.round(score), 0, 100);
}

function riskFromVolatility(volatility) {
  if (volatility == null) return 'unknown';
  if (volatility >= 55) return 'high';
  if (volatility >= 32) return 'medium';
  return 'low';
}

// Maps the composite score + trend posture to an actionable label.
function decideAction(score, factors) {
  const trendingDown = factors.vsSma60Pct != null && factors.vsSma60Pct < -3;
  if (score >= 70 && !trendingDown) return 'buy';
  if (score >= 58) return 'accumulate';
  if (score >= 45) return 'hold';
  if (score >= 33) return 'reduce';
  return 'avoid';
}

function levelForScore(score) {
  if (score >= 70) return 'strong';
  if (score >= 58) return 'watch';
  if (score >= 45) return 'neutral';
  return 'weak';
}

function confidenceFromCoverage(factors) {
  // More history + lower volatility = more trustworthy signal.
  const bars = Number(factors.barCount) || 0;
  let coverage = bars >= 250 ? 1 : bars >= 120 ? 0.8 : bars >= 60 ? 0.6 : bars >= 20 ? 0.4 : 0.2;
  if (factors.volatility != null && factors.volatility >= 55) coverage -= 0.1;
  return clamp(Math.round(coverage * 100), 10, 100);
}

const WEIGHTS = { trend: 0.4, momentum: 0.32, meanReversion: 0.18, volume: 0.1 };

/**
 * Computes an algorithmic trade signal for a single instrument from its daily
 * bar series. Returns null when there is not enough data to score.
 *
 * @param {object} input
 * @param {object} input.instrument - { symbol, displaySymbol, name }
 * @param {Array} input.bars - ascending daily OHLCV bars
 * @param {object|null} [input.liveQuote] - optional latest snapshot for freshness overlay
 */
export function buildQuantSignal({ instrument, bars = [], liveQuote = null, asOf = null }) {
  if (!Array.isArray(bars) || bars.length < 20) return null;
  const factors = computeFactors(bars);
  if (factors.lastClose == null) return null;

  const reasons = [];
  const subScores = {
    trend: trendScore(factors, reasons),
    momentum: momentumScore(factors, reasons),
    meanReversion: meanReversionScore(factors, reasons),
    volume: volumeScore(factors, reasons),
  };

  const composite =
    subScores.trend * WEIGHTS.trend +
    subScores.momentum * WEIGHTS.momentum +
    subScores.meanReversion * WEIGHTS.meanReversion +
    subScores.volume * WEIGHTS.volume;
  const score = clamp(Math.round(composite), 0, 100);
  const action = decideAction(score, factors);
  if (reasons.length === 0) addReason(reasons, 'range_bound');

  const symbol = instrument?.symbol || liveQuote?.krxSymbol || liveQuote?.symbol || null;
  return {
    symbol,
    displaySymbol: instrument?.displaySymbol || instrument?.symbol || symbol,
    name: instrument?.name || null,
    score,
    level: levelForScore(score),
    action,
    risk: riskFromVolatility(factors.volatility),
    confidence: confidenceFromCoverage(factors),
    factors: {
      trend: subScores.trend,
      momentum: subScores.momentum,
      meanReversion: subScores.meanReversion,
      volume: subScores.volume,
    },
    indicators: {
      lastClose: roundOrNull(factors.lastClose, 2),
      sma20: roundOrNull(factors.sma20, 2),
      sma60: roundOrNull(factors.sma60, 2),
      vsSma20Pct: roundOrNull(factors.vsSma20Pct, 2),
      vsSma60Pct: roundOrNull(factors.vsSma60Pct, 2),
      return20d: roundOrNull(factors.return20d, 2),
      return60d: roundOrNull(factors.return60d, 2),
      rsi14: roundOrNull(factors.rsi14, 1),
      volatility: roundOrNull(factors.volatility, 1),
      vsHigh52wPct: roundOrNull(factors.vsHigh52wPct, 2),
      volumeRatio: roundOrNull(factors.volumeRatio, 2),
    },
    reasonCodes: reasons,
    barCount: factors.barCount,
    lastBarDate: bars[bars.length - 1]?.date || null,
    liveQuote: liveQuote || null,
    updatedAt: asOf || new Date().toISOString(),
  };
}
