/** Fujimoto-style KR screener preset (growth + value + oversold). */

export const FUJIMOTO_PRESET = 'fujimoto';
export const FUJIMOTO_TITLE = '성장·저평가 눌림';
export const FUJIMOTO_MAX_ITEMS = 20;
/** Default daily turnover floor (KRW) when snapshot omits minTurnoverKrw. */
export const FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW = 10_000_000_000;

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value) {
  if (typeof value === 'boolean') return value;
  return null;
}

/**
 * @param {object} row snapshot symbol metrics
 * @param {{ minTurnoverKrw?: number }} policy
 */
export function passesFujimoto(row, policy = {}) {
  const minTurnover =
    num(policy.minTurnoverKrw) ?? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW;

  const revenueYoY = num(row?.revenueYoY);
  const operatingProfitYoY = num(row?.operatingProfitYoY);
  const netProfitYoY = num(row?.netProfitYoY);
  if (revenueYoY == null || operatingProfitYoY == null || netProfitYoY == null) return false;
  if (!(revenueYoY > 0 && operatingProfitYoY > 0 && netProfitYoY > 0)) return false;

  const per = num(row?.per);
  const pbr = num(row?.pbr);
  if (per == null || pbr == null) return false;
  if (!(per > 0 && per <= 15)) return false;
  if (!(pbr > 0 && pbr <= 1)) return false;

  const dividend = bool(row?.dividend);
  const dividendGrowthCapacity = bool(row?.dividendGrowthCapacity);
  if (dividend !== true && dividendGrowthCapacity !== true) return false;

  const turnoverKrw = num(row?.turnoverKrw);
  if (turnoverKrw == null || turnoverKrw < minTurnover) return false;

  const rsi = num(row?.rsi);
  if (rsi == null || rsi > 30) return false;

  return true;
}

export function sortFujimotoItems(items) {
  return [...items].sort((a, b) => {
    const rsiA = num(a?.rsi) ?? Number.POSITIVE_INFINITY;
    const rsiB = num(b?.rsi) ?? Number.POSITIVE_INFINITY;
    if (rsiA !== rsiB) return rsiA - rsiB;
    const chA = num(a?.changePercent) ?? 0;
    const chB = num(b?.changePercent) ?? 0;
    return chA - chB;
  });
}

/**
 * Build curation items from a snapshot payload.
 * @param {object} snapshot
 */
export function applyFujimotoToSnapshot(snapshot) {
  const symbols = Array.isArray(snapshot?.symbols) ? snapshot.symbols : [];
  const minTurnoverKrw =
    num(snapshot?.policy?.minTurnoverKrw) ?? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW;
  const passed = [];
  for (const row of symbols) {
    if (!passesFujimoto(row, { minTurnoverKrw })) continue;
    passed.push({
      ...row,
      passed: true,
      aiGenerated: false,
      note: row.note || '',
    });
  }
  return sortFujimotoItems(passed).slice(0, FUJIMOTO_MAX_ITEMS);
}
