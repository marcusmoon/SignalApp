import { buildQuantSignal } from './signals.mjs';
import { roundOrNull } from './factors.mjs';

// Actions are grouped by directional thesis so we can score them against the
// realized forward return.
const BULLISH_ACTIONS = new Set(['buy', 'accumulate']);
const BEARISH_ACTIONS = new Set(['reduce', 'avoid']);

function emptyBucket() {
  return { count: 0, wins: 0, sumReturn: 0, returns: [] };
}

function summarizeBucket(bucket, { directional = true } = {}) {
  const count = bucket.count;
  if (count === 0) return { count: 0, winRate: null, avgReturn: null, medianReturn: null };
  const sorted = [...bucket.returns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    count,
    // `hold` is directionally neutral, so a win/loss rate is not meaningful.
    winRate: directional ? roundOrNull((bucket.wins / count) * 100, 1) : null,
    avgReturn: roundOrNull(bucket.sumReturn / count, 2),
    medianReturn: roundOrNull(median, 2),
  };
}

function isWin(action, forwardReturn) {
  if (BULLISH_ACTIONS.has(action)) return forwardReturn > 0;
  if (BEARISH_ACTIONS.has(action)) return forwardReturn < 0;
  return null; // hold is directionally neutral
}

/**
 * Walk-forward backtest for a single instrument's daily bar series.
 *
 * At each historical day t (after a warmup window) the signal is recomputed
 * using only bars up to and including t, then scored against the realized
 * forward return over `horizon` trading days. This avoids look-ahead bias
 * because the engine never sees future bars.
 *
 * @param {object} input
 * @param {object} input.instrument - { symbol, displaySymbol, name }
 * @param {Array} input.bars - ascending daily OHLCV bars
 * @param {number} [input.horizon] - forward window in trading days
 * @param {number} [input.warmup] - minimum bars before scoring starts
 * @param {number} [input.step] - sampling stride to keep cost bounded
 */
export function backtestInstrument({ instrument, bars = [], horizon = 20, warmup = 80, step = 1 }) {
  const safeHorizon = Math.max(1, Math.min(120, Math.floor(Number(horizon) || 20)));
  const safeWarmup = Math.max(20, Math.floor(Number(warmup) || 80));
  const safeStep = Math.max(1, Math.floor(Number(step) || 1));
  if (!Array.isArray(bars) || bars.length < safeWarmup + safeHorizon + 1) return null;

  const closeAt = (index) => {
    const bar = bars[index];
    const value = Number(bar?.adjClose ?? bar?.close);
    return Number.isFinite(value) ? value : null;
  };

  const byAction = {
    buy: emptyBucket(),
    accumulate: emptyBucket(),
    hold: emptyBucket(),
    reduce: emptyBucket(),
    avoid: emptyBucket(),
  };
  const directional = { bullish: emptyBucket(), bearish: emptyBucket() };
  let samples = 0;
  let directionalWins = 0;
  let directionalCount = 0;

  const lastScorable = bars.length - 1 - safeHorizon;
  for (let t = safeWarmup; t <= lastScorable; t += safeStep) {
    const entry = closeAt(t);
    const exit = closeAt(t + safeHorizon);
    if (entry == null || exit == null || entry === 0) continue;
    const signal = buildQuantSignal({ instrument, bars: bars.slice(0, t + 1) });
    if (!signal) continue;
    const forwardReturn = ((exit - entry) / entry) * 100;
    const action = signal.action;
    const bucket = byAction[action];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.sumReturn += forwardReturn;
    bucket.returns.push(forwardReturn);
    samples += 1;
    const win = isWin(action, forwardReturn);
    if (win === true) bucket.wins += 1;

    if (BULLISH_ACTIONS.has(action)) {
      directional.bullish.count += 1;
      directional.bullish.sumReturn += forwardReturn;
      directional.bullish.returns.push(forwardReturn);
      if (forwardReturn > 0) directional.bullish.wins += 1;
      directionalCount += 1;
      if (forwardReturn > 0) directionalWins += 1;
    } else if (BEARISH_ACTIONS.has(action)) {
      directional.bearish.count += 1;
      directional.bearish.sumReturn += forwardReturn;
      directional.bearish.returns.push(forwardReturn);
      if (forwardReturn < 0) directional.bearish.wins += 1;
      directionalCount += 1;
      if (forwardReturn < 0) directionalWins += 1;
    }
  }

  if (samples === 0) return null;

  return {
    symbol: instrument?.symbol || null,
    displaySymbol: instrument?.displaySymbol || instrument?.symbol || null,
    name: instrument?.name || null,
    horizon: safeHorizon,
    warmup: safeWarmup,
    step: safeStep,
    samples,
    barCount: bars.length,
    firstBarDate: bars[0]?.date || null,
    lastBarDate: bars[bars.length - 1]?.date || null,
    byAction: {
      buy: summarizeBucket(byAction.buy),
      accumulate: summarizeBucket(byAction.accumulate),
      hold: summarizeBucket(byAction.hold, { directional: false }),
      reduce: summarizeBucket(byAction.reduce),
      avoid: summarizeBucket(byAction.avoid),
    },
    directional: {
      bullish: summarizeBucket(directional.bullish),
      bearish: summarizeBucket(directional.bearish),
      hitRate: directionalCount > 0 ? roundOrNull((directionalWins / directionalCount) * 100, 1) : null,
      count: directionalCount,
    },
  };
}

// Combines per-symbol bucket counters into a portfolio-level view so the API can
// surface one headline hit rate across the whole universe.
function mergeBuckets(target, summary) {
  if (!summary || summary.count === 0) return;
  target.count += summary.count;
  if (summary.winRate != null) target.wins += Math.round((summary.winRate / 100) * summary.count);
  if (summary.avgReturn != null) target.sumReturn += summary.avgReturn * summary.count;
}

export function aggregateBacktests(results = []) {
  const actions = ['buy', 'accumulate', 'hold', 'reduce', 'avoid'];
  const byAction = Object.fromEntries(actions.map((action) => [action, { count: 0, wins: 0, sumReturn: 0 }]));
  let directionalWins = 0;
  let directionalCount = 0;
  let samples = 0;

  for (const result of results) {
    if (!result) continue;
    samples += result.samples || 0;
    for (const action of actions) mergeBuckets(byAction[action], result.byAction?.[action]);
    const dir = result.directional;
    if (dir?.count) {
      directionalCount += dir.count;
      if (dir.hitRate != null) directionalWins += Math.round((dir.hitRate / 100) * dir.count);
    }
  }

  const summarize = (bucket, { directional = true } = {}) =>
    bucket.count === 0
      ? { count: 0, winRate: null, avgReturn: null }
      : {
          count: bucket.count,
          winRate: directional ? roundOrNull((bucket.wins / bucket.count) * 100, 1) : null,
          avgReturn: roundOrNull(bucket.sumReturn / bucket.count, 2),
        };

  return {
    symbols: results.filter(Boolean).length,
    samples,
    directionalHitRate: directionalCount > 0 ? roundOrNull((directionalWins / directionalCount) * 100, 1) : null,
    directionalCount,
    byAction: Object.fromEntries(
      actions.map((action) => [action, summarize(byAction[action], { directional: action !== 'hold' })]),
    ),
  };
}
