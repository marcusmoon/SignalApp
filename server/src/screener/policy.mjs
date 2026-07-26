import { FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW } from './fujimoto.mjs';

/** Wilder RSI period used in pool snapshots. */
export const SCREENER_RSI_PERIOD = 14;

export function buildPoolPolicy(market = 'kr') {
  return {
    minTurnoverKrw: market === 'kr' ? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW : null,
    minTurnoverUsd: null,
    requireAllMetrics: true,
    nullMeansFail: true,
    /** YoY fields are ratios: 0.08 = +8%. Never interpret as percent points. */
    yoyUnit: 'ratio',
    rsiPeriod: SCREENER_RSI_PERIOD,
  };
}
