import { MEGA_CAP_SET, normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import type { AppLocale, MessageId } from '@/locales/messages';
import { formatMessage, messages } from '@/locales/messages';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import {
  calendarRangeForFiscalYear,
  normalizeConcallWatchSet,
  pickSymbolsFromEarningsRows,
  rowMatchesFiscalSelection,
  sortEarningsRowsForTranscript,
} from '@/domain/concalls';
import {
  earningsRowDate,
  earningsRowHour,
  earningsRowQuarter,
  earningsRowSymbol,
  earningsRowYear,
} from '@/domain/concalls/signalCalendarEarnings';
import { fetchSignalEarningsCalendarRangeMerged } from '@/integrations/signal-api/calendarRange';
import { fetchSignalConcalls } from '@/integrations/signal-api/concalls';
import {
  clearSignalConcallsCache,
  CONCALL_CACHE_TTL_MS,
} from '@/integrations/signal-api/cache/concallsCache';
import type { SignalApiCalendarEvent, SignalApiConcall } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { ConcallSummary } from '@/types/signal';
import { addDays } from '@/utils/date';

type SummaryEntry = { items: ConcallSummary[]; expiresAt: number };
const concallSummaryByKey = new Map<string, SummaryEntry>();

function peekConcallSummary(key: string): ConcallSummary[] | null {
  const e = concallSummaryByKey.get(key);
  if (e && Date.now() < e.expiresAt) return e.items;
  return null;
}

function storeConcallSummary(key: string, items: ConcallSummary[]): void {
  concallSummaryByKey.set(key, { items, expiresAt: Date.now() + CONCALL_CACHE_TTL_MS });
}

function deleteConcallSummary(key: string): void {
  concallSummaryByKey.delete(key);
}

/** Clears Signal `/v1/concalls` response cache + in-memory concall summary list cache */
export function clearConcallClientMemoryCaches(): void {
  clearSignalConcallsCache();
  concallSummaryByKey.clear();
}

function locMsg(locale: AppLocale, id: MessageId, vars?: Record<string, string | number>): string {
  return formatMessage(messages[locale][id], vars);
}

function sourceFromConcall(row: SignalApiConcall): ConcallSummary['source'] {
  if (row.summaryProvider === 'openai' || row.summaryProvider === 'claude') return row.summaryProvider;
  return 'fallback';
}

function summaryFromSignalConcall(row: SignalApiConcall, quarterLabel: string, locale: AppLocale): ConcallSummary {
  const bullets = Array.isArray(row.summaryBullets) && row.summaryBullets.length > 0
    ? row.summaryBullets.slice(0, 3)
    : [locMsg(locale, 'callsTranscriptStored'), locMsg(locale, 'callsTranscriptStoredHint')];
  return {
    id: row.id,
    ticker: row.symbol,
    quarter: quarterLabel,
    bullets,
    guidance: row.guidance || undefined,
    risk: row.risk || undefined,
    source: sourceFromConcall(row),
    transcriptSnippet: row.transcriptSnippet || row.transcript,
  };
}

async function fetchSignalConcallForRow(
  ticker: string,
  row: SignalApiCalendarEvent,
  locale: AppLocale,
): Promise<ConcallSummary | null> {
  const fy = earningsRowYear(row);
  const fq = earningsRowQuarter(row);
  const list = await fetchSignalConcalls({
    symbol: ticker,
    fiscalYear: fy,
    fiscalQuarter: fq,
    pageSize: 1,
  }).catch(() => []);
  let hit = list[0];
  if (!hit) {
    const latest = await fetchSignalConcalls({ symbol: ticker, pageSize: 1 }).catch(() => []);
    hit = latest[0];
  }
  if (!hit) return null;
  const quarterLabel = locMsg(locale, 'fiscalYearQuarterShort', { y: fy, q: fq });
  return summaryFromSignalConcall(hit, quarterLabel, locale);
}

export type FetchConcallSummariesOptions = {
  /** 메가캡 유니버스 vs 시세 관심종목 (설정과 동일) */
  scope: CalendarConcallScope;
  /** scope가 watch일 때 사용 · 시세·설정 관심 티커 */
  watchlistSymbols?: string[];
  fiscalYear?: number;
  fiscalQuarter?: 0 | 1 | 2 | 3 | 4;
  /**
   * 롤링 모드(FY 미지정)에서 실적 캘린더 구간(일). 기본 과거 14·미래 21.
   * 종목 상세 등에서는 넓혀 최근 분기 트랜스크립트 후보를 잡습니다.
   */
  rollingEarningsPastDays?: number;
  rollingEarningsFutureDays?: number;
  /** true면 캐시를 쓰지 않고 새로 조회 (당겨서 새로고침 등) */
  forceRefresh?: boolean;
  /** false면 메모리 캐시를 읽지도 쓰지도 않음 (설정에서 끈 경우) */
  cacheEnabled?: boolean;
  /** UI 로케(에러·힌트 문구). 기본 ko */
  locale?: AppLocale;
};

export async function fetchConcallSummaries(
  maxItemsParam = 3,
  options?: FetchConcallSummariesOptions,
): Promise<ConcallSummary[]> {
  if (!hasSignalApi()) {
    throw new Error('SIGNAL_API_BASE_URL_MISSING');
  }
  const scope = options?.scope ?? 'mega';
  const watchSet = normalizeConcallWatchSet(options?.watchlistSymbols);
  const watchSorted = [...watchSet].sort();
  const fiscalYearForKey = options?.fiscalYear != null ? options.fiscalYear : null;
  const useFiscal = fiscalYearForKey != null;
  const fiscalQuarterForKey = options?.fiscalQuarter ?? 0;
  const symbolCap = useFiscal ? 10 : maxItemsParam;
  const rollPast = options?.rollingEarningsPastDays;
  const rollFuture = options?.rollingEarningsFutureDays;
  const locale: AppLocale = options?.locale ?? 'ko';
  const scopeKey = scope === 'watch' ? `watch:${watchSorted.join(',')}` : 'mega';
  const rollKey =
    fiscalYearForKey == null ? `roll:${rollPast ?? 14}:${rollFuture ?? 21}:cap${symbolCap}` : '';
  const cacheKey = `summary|${scopeKey}|${rollKey}|fy:${fiscalYearForKey ?? 'roll'}|fq:${fiscalQuarterForKey}|${locale}`;

  const cacheEnabled = options?.cacheEnabled !== false;

  if (cacheEnabled) {
    if (options?.forceRefresh) {
      deleteConcallSummary(cacheKey);
    } else {
      const hit = peekConcallSummary(cacheKey);
      if (hit) return hit;
    }
  }

  if (scope === 'watch' && watchSet.size === 0) {
    if (cacheEnabled) storeConcallSummary(cacheKey, []);
    return [];
  }

  const fiscalYear = options?.fiscalYear;
  const fiscalQuarter = options?.fiscalQuarter ?? 0;
  const cap = symbolCap;

  let rows: SignalApiCalendarEvent[];
  if (useFiscal && fiscalYear != null) {
    const { from, to } = calendarRangeForFiscalYear(fiscalYear);
    rows = await fetchSignalEarningsCalendarRangeMerged(from, to);
    rows = rows.filter((r) => rowMatchesFiscalSelection(r, fiscalYear, fiscalQuarter));
  } else {
    const past = options?.rollingEarningsPastDays ?? 14;
    const future = options?.rollingEarningsFutureDays ?? 21;
    const from = addDays(new Date(), -past);
    const to = addDays(new Date(), future);
    rows = await fetchSignalEarningsCalendarRangeMerged(from, to);
  }

  if (scope === 'mega') {
    rows = rows.filter((r) => earningsRowSymbol(r) && MEGA_CAP_SET.has(normalizeEarningsSymbolForMatch(earningsRowSymbol(r))));
  } else {
    rows = rows.filter((r) => earningsRowSymbol(r) && watchSet.has(normalizeEarningsSymbolForMatch(earningsRowSymbol(r))));
  }
  rows = sortEarningsRowsForTranscript(rows, scope === 'mega');

  const symbols = pickSymbolsFromEarningsRows(rows, cap);

  const out: ConcallSummary[] = [];

  if (symbols.length === 0) {
    if (scope === 'watch') {
      if (cacheEnabled) storeConcallSummary(cacheKey, []);
      return [];
    }
    const fiscalSummary =
      useFiscal && fiscalYear != null
        ? fiscalQuarter > 0
          ? locMsg(locale, 'fiscalYearQuarterShort', { y: fiscalYear, q: fiscalQuarter })
          : locMsg(locale, 'concallFiscalYearWithAllQuarters', {
              y: fiscalYear,
              all: locMsg(locale, 'callsFiscalAll'),
            })
        : '';
    const emptyCal: ConcallSummary[] = [
      {
        id: 'empty-cal',
        ticker: '—',
        quarter: '—',
        bullets: useFiscal
          ? [
              locMsg(locale, 'concallEmptyMegaFiscalLine1', { fiscalSummary }),
              locMsg(locale, 'concallEmptyMegaFiscalLine2'),
            ]
          : [locMsg(locale, 'concallEmptyMegaRollingLine1'), locMsg(locale, 'concallEmptyMegaRollingLine2')],
        source: 'fallback',
      },
    ];
    if (cacheEnabled) storeConcallSummary(cacheKey, emptyCal);
    return emptyCal;
  }

  for (const sym of symbols) {
    const row = rows.find(
      (r) => normalizeEarningsSymbolForMatch(earningsRowSymbol(r)) === normalizeEarningsSymbolForMatch(sym),
    );

    const quarterLabel = row
      ? locMsg(locale, 'fiscalYearQuarterShort', { y: earningsRowYear(row), q: earningsRowQuarter(row) })
      : locMsg(locale, 'concallQuarterRecentFallback');

    if (row) {
      const stored = await fetchSignalConcallForRow(sym, row, locale);
      if (stored) {
        out.push(stored);
        continue;
      }
    }

    out.push({
      id: `${sym}-server-only`,
      ticker: sym,
      quarter: quarterLabel,
      bullets: [locMsg(locale, 'callsAiSignalServerOnly'), locMsg(locale, 'callsAiSignalServerOnlyHint')],
      guidance: row
        ? locMsg(locale, 'concallGuidanceEarningsDate', {
            date: earningsRowDate(row),
            hour: earningsRowHour(row),
          })
        : undefined,
      risk: undefined,
      source: 'fallback',
    });
  }

  if (cacheEnabled) storeConcallSummary(cacheKey, out);
  return out;
}

/**
 * 종목 상세에서 특정 실적 행(FY·분기)을 골랐을 때만 쓰는 단일 요약.
 * `fetchConcallSummaries`와 동일한 트랜스크립트·요약 파이프라인이며 캐시 키는 티커·분기·일정별로 분리합니다.
 */
export async function fetchConcallSummaryForEarningsRow(
  ticker: string,
  row: SignalApiCalendarEvent,
  options?: { forceRefresh?: boolean; cacheEnabled?: boolean; locale?: AppLocale },
): Promise<ConcallSummary> {
  if (!hasSignalApi()) {
    throw new Error('SIGNAL_API_BASE_URL_MISSING');
  }
  const sym = ticker.trim().toUpperCase();
  const locale: AppLocale = options?.locale ?? 'ko';
  const cacheKey = `v1|single|${normalizeEarningsSymbolForMatch(sym)}|${earningsRowYear(row)}|${earningsRowQuarter(row)}|${earningsRowDate(row)}|${locale}`;
  const cacheEnabled = options?.cacheEnabled !== false;

  if (cacheEnabled && options?.forceRefresh) {
    deleteConcallSummary(cacheKey);
  }

  const quarterLabel = locMsg(locale, 'fiscalYearQuarterShort', {
    y: earningsRowYear(row),
    q: earningsRowQuarter(row),
  });
  const stored = await fetchSignalConcallForRow(sym, row, locale);
  if (stored) {
    if (cacheEnabled) storeConcallSummary(cacheKey, [stored]);
    return stored;
  }

  const summary: ConcallSummary = {
    id: `${sym}-server-only`,
    ticker: sym,
    quarter: quarterLabel,
    bullets: [locMsg(locale, 'callsAiSignalServerOnly'), locMsg(locale, 'callsAiSignalServerOnlyHint')],
    guidance: locMsg(locale, 'concallGuidanceEarningsDate', {
      date: earningsRowDate(row),
      hour: earningsRowHour(row),
    }),
    risk: undefined,
    source: 'fallback',
  };
  if (cacheEnabled) storeConcallSummary(cacheKey, [summary]);
  return summary;
}
