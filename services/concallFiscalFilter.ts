import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultConcallFiscal,
  type ConcallFiscalState,
  type FiscalQuarterFilter,
} from '@/domain/concalls/fiscal';

export type { ConcallFiscalState, FiscalQuarterFilter } from '@/domain/concalls/fiscal';
export {
  buildConcallYearOptions,
  calendarQuarterFromDate,
  calendarRangeForFiscalYear,
  defaultConcallFiscal,
} from '@/domain/concalls/fiscal';

const STORAGE_KEY = '@signal/concall_fiscal_v1';

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
