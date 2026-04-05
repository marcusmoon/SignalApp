import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/concall_fiscal_v1';

/** 0 = 해당 연도 전체 분기 */
export type FiscalQuarterFilter = 0 | 1 | 2 | 3 | 4;

export type ConcallFiscalState = {
  fiscalYear: number;
  fiscalQuarter: FiscalQuarterFilter;
};

/** 로컬 날짜 기준 달력 분기 (1–4). Finnhub 필터의 분기 선택과 동일 스킴. */
export function calendarQuarterFromDate(d: Date): Exclude<FiscalQuarterFilter, 0> {
  const m = d.getMonth();
  if (m < 3) return 1;
  if (m < 6) return 2;
  if (m < 9) return 3;
  return 4;
}

/** 저장값이 없을 때: 현재 연도 + 이번 달력 분기 (전체 분기 `0`이 아님) */
export function defaultConcallFiscal(): ConcallFiscalState {
  const d = new Date();
  return {
    fiscalYear: d.getFullYear(),
    fiscalQuarter: calendarQuarterFromDate(d),
  };
}

/** 컨콜 연도 칩 (현재 연도 기준 ±) */
export function buildConcallYearOptions(): number[] {
  const y = new Date().getFullYear();
  return [y - 4, y - 3, y - 2, y - 1, y, y + 1];
}

/** Finnhub 실적 발표일이 FY에 걸쳐 있어 전후로 넉넉히 잡음 */
export function calendarRangeForFiscalYear(fiscalYear: number): { from: Date; to: Date } {
  const from = new Date(fiscalYear - 1, 0, 1);
  const to = new Date(fiscalYear + 1, 11, 31);
  return { from, to };
}

export async function loadConcallFiscalFilter(): Promise<ConcallFiscalState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConcallFiscal();
    const j = JSON.parse(raw) as { fiscalYear?: number; fiscalQuarter?: number };
    const fy =
      typeof j.fiscalYear === 'number' && j.fiscalYear >= 2000 && j.fiscalYear <= 2100
        ? j.fiscalYear
        : defaultConcallFiscal().fiscalYear;
    const fq = [0, 1, 2, 3, 4].includes(j.fiscalQuarter ?? -1)
      ? (j.fiscalQuarter as FiscalQuarterFilter)
      : 0;
    return { fiscalYear: fy, fiscalQuarter: fq };
  } catch {
    return defaultConcallFiscal();
  }
}

export async function saveConcallFiscalFilter(state: ConcallFiscalState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
