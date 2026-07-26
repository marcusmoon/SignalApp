import { FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW } from './fujimoto.mjs';

/** Wilder RSI period used in pool snapshots. */
export const SCREENER_RSI_PERIOD = 14;

export function buildPoolPolicy(market = 'kr') {
  return {
    minTurnoverKrw: market === 'kr' ? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW : null,
    minTurnoverUsd: null,
    requireAllMetrics: true,
    nullMeansFail: true,
    /** YoY / return* / pctFrom52wHigh are ratios: 0.08 = +8%. */
    yoyUnit: 'ratio',
    returnUnit: 'ratio',
    rsiPeriod: SCREENER_RSI_PERIOD,
    /** Trading-day lookbacks used for momentum slots. */
    momentumLookbacks: {
      return3m: 63,
      return6m: 126,
      return12m: 252,
      ma: [20, 60, 120, 200],
      high52w: 252,
      volumeAvg: 20,
    },
  };
}
