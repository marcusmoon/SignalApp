import { MEGA_CAP_SET, normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import type { AppLocale, MessageId } from '@/locales/messages';
import { formatMessage, messages } from '@/locales/messages';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import {
  calendarRangeForFiscalYear,
  clipTranscriptForDisplay,
  CONCALL_TRANSCRIPT_SNIPPET_MAX_CHARS,
  isEarningsDateInFuture,
  normalizeConcallWatchSet,
  pickSymbolsFromEarningsRows,
  rowMatchesFiscalSelection,
  sortEarningsRowsForTranscript,
} from '@/domain/concalls';
import { fetchEarningsCallTranscript } from '@/integrations/api-ninjas';
import { summarizeConcallTranscriptSelected } from '@/services/aiSummaries';
import { fetchEarningsCalendarRangeMerged, type FinnhubEarningsRow } from '@/integrations/finnhub';
import {
  buildConcallCacheKey,
  deleteConcallCache,
  peekConcallCache,
  storeConcallCache,
} from '@/integrations/concalls/cache';
import { hasApiNinjas, hasFinnhub } from '@/services/env';
import type { ConcallSummary } from '@/types/signal';
import { addDays } from '@/utils/date';

function locMsg(locale: AppLocale, id: MessageId, vars?: Record<string, string | number>): string {
  return formatMessage(messages[locale][id], vars);
}

function concallNinjaHint(
  ninjasStatus: number,
  row: FinnhubEarningsRow | undefined,
  locale: AppLocale,
): string {
  if (!hasApiNinjas()) {
    return locMsg(locale, 'concallHintNinjasKeyMissing');
  }
  if (ninjasStatus === 401) {
    return locMsg(locale, 'concallHintNinjas401');
  }
  if (ninjasStatus === 403) {
    return locMsg(locale, 'concallHintNinjas403');
  }
  if (ninjasStatus === 429) {
    return locMsg(locale, 'concallHintNinjas429');
  }
  if (ninjasStatus === 404) {
    return locMsg(locale, 'concallHintNinjas404');
  }
  if (row) {
    if (isEarningsDateInFuture(row.date)) {
      return locMsg(locale, 'concallHintNinjasFutureDate');
    }
    if (ninjasStatus === 200) {
      return locMsg(locale, 'concallHintNinjasPastNoTranscript');
    }
  }
  return locMsg(locale, 'concallHintNinjasGeneric');
}

export type FetchConcallSummariesOptions = {
  /** 메가캡 유니버스 vs 시세 관심종목 (설정과 동일) */
  scope: CalendarConcallScope;
  /** scope가 watch일 때 사용 · 시세·설정 관심 티커 */
  watchlistSymbols?: string[];
  fiscalYear?: number;
  fiscalQuarter?: 0 | 1 | 2 | 3 | 4;
  /**
   * 롤링 모드(FY 미지정)에서 Finnhub 실적 캘린더 구간(일). 기본 과거 14·미래 21.
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
  if (!hasFinnhub()) {
    throw new Error('FINNHUB_TOKEN_MISSING');
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
  const cacheKey = `${buildConcallCacheKey({
    symbolCap,
    scope,
    watchSorted: scope === 'watch' ? watchSorted : [],
    fiscalYear: fiscalYearForKey,
    fiscalQuarter: fiscalQuarterForKey,
    rollingPastDays: rollPast,
    rollingFutureDays: rollFuture,
  })}|${locale}`;

  const cacheEnabled = options?.cacheEnabled !== false;

  if (cacheEnabled) {
    if (options?.forceRefresh) {
      deleteConcallCache(cacheKey);
    } else {
      const hit = peekConcallCache(cacheKey);
      if (hit) {
        return hit;
      }
    }
  }

  if (scope === 'watch' && watchSet.size === 0) {
    if (cacheEnabled) storeConcallCache(cacheKey, []);
    return [];
  }

  const fiscalYear = options?.fiscalYear;
  const fiscalQuarter = options?.fiscalQuarter ?? 0;
  const cap = symbolCap;

  let rows: FinnhubEarningsRow[];
  if (useFiscal && fiscalYear != null) {
    const { from, to } = calendarRangeForFiscalYear(fiscalYear);
    rows = await fetchEarningsCalendarRangeMerged(from, to);
    rows = rows.filter((r) => rowMatchesFiscalSelection(r, fiscalYear, fiscalQuarter));
  } else {
    const past = options?.rollingEarningsPastDays ?? 14;
    const future = options?.rollingEarningsFutureDays ?? 21;
    const from = addDays(new Date(), -past);
    const to = addDays(new Date(), future);
    rows = await fetchEarningsCalendarRangeMerged(from, to);
  }

  if (scope === 'mega') {
    rows = rows.filter((r) => r.symbol && MEGA_CAP_SET.has(normalizeEarningsSymbolForMatch(r.symbol)));
  } else {
    rows = rows.filter((r) => r.symbol && watchSet.has(normalizeEarningsSymbolForMatch(r.symbol)));
  }
  rows = sortEarningsRowsForTranscript(rows, scope === 'mega');

  const symbols = pickSymbolsFromEarningsRows(rows, cap);

  const out: ConcallSummary[] = [];

  if (symbols.length === 0) {
    if (scope === 'watch') {
      if (cacheEnabled) storeConcallCache(cacheKey, []);
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
    if (cacheEnabled) storeConcallCache(cacheKey, emptyCal);
    return emptyCal;
  }

  for (const sym of symbols) {
    const row = rows.find(
      (r) => normalizeEarningsSymbolForMatch(r.symbol) === normalizeEarningsSymbolForMatch(sym),
    );
    let text: string | null = null;
    let ninjasStatus = 0;

    if (row) {
      const r1 = await fetchEarningsCallTranscript(sym, { year: row.year, quarter: row.quarter });
      text = r1.transcript;
      ninjasStatus = r1.httpStatus;
    }
    if (!text || text.length < 200) {
      const r2 = await fetchEarningsCallTranscript(sym);
      text = r2.transcript;
      ninjasStatus = r2.httpStatus || ninjasStatus;
    }

    const quarterLabel = row
      ? locMsg(locale, 'fiscalYearQuarterShort', { y: row.year, q: row.quarter })
      : locMsg(locale, 'concallQuarterRecentFallback');

    if (!text || text.length < 200) {
      const hint = concallNinjaHint(ninjasStatus, row, locale);

      out.push({
        id: `${sym}-pending`,
        ticker: sym,
        quarter: quarterLabel,
        bullets: [locMsg(locale, 'concallFallbackTranscriptNotFound'), hint],
        guidance: row
          ? locMsg(locale, 'concallGuidanceEarningsDate', { date: row.date, hour: row.hour })
          : undefined,
        risk: undefined,
        source: 'fallback',
      });
      continue;
    }

    try {
      const summary = await summarizeConcallTranscriptSelected(sym, quarterLabel, text);
      out.push(summary);
    } catch {
      out.push({
        id: `${sym}-err`,
        ticker: sym,
        quarter: quarterLabel,
        bullets: [locMsg(locale, 'concallFallbackSummaryFailed'), '—'],
        source: 'fallback',
      });
    }
  }

  if (cacheEnabled) storeConcallCache(cacheKey, out);
  return out;
}

/**
 * 종목 상세에서 특정 실적 행(FY·분기)을 골랐을 때만 쓰는 단일 요약.
 * `fetchConcallSummaries`와 동일한 트랜스크립트·요약 파이프라인이며 캐시 키는 티커·분기·일정별로 분리합니다.
 */
export async function fetchConcallSummaryForEarningsRow(
  ticker: string,
  row: FinnhubEarningsRow,
  options?: { forceRefresh?: boolean; cacheEnabled?: boolean; locale?: AppLocale },
): Promise<ConcallSummary> {
  if (!hasFinnhub()) {
    throw new Error('FINNHUB_TOKEN_MISSING');
  }
  const sym = ticker.trim().toUpperCase();
  const locale: AppLocale = options?.locale ?? 'ko';
  const cacheKey = `v1|single|${normalizeEarningsSymbolForMatch(sym)}|${row.year}|${row.quarter}|${row.date}|${locale}`;
  const cacheEnabled = options?.cacheEnabled !== false;

  if (cacheEnabled) {
    if (options?.forceRefresh) {
      deleteConcallCache(cacheKey);
    } else {
      const hit = peekConcallCache(cacheKey);
      if (hit && hit.length > 0) {
        return hit[0]!;
      }
    }
  } else if (options?.forceRefresh) {
    deleteConcallCache(cacheKey);
  }

  let text: string | null = null;
  let ninjasStatus = 0;
  const r1 = await fetchEarningsCallTranscript(sym, { year: row.year, quarter: row.quarter });
  text = r1.transcript;
  ninjasStatus = r1.httpStatus;
  if (!text || text.length < 200) {
    const r2 = await fetchEarningsCallTranscript(sym);
    text = r2.transcript;
    ninjasStatus = r2.httpStatus || ninjasStatus;
  }

  const quarterLabel = locMsg(locale, 'fiscalYearQuarterShort', { y: row.year, q: row.quarter });

  if (!text || text.length < 200) {
    const hint = concallNinjaHint(ninjasStatus, row, locale);
    const summary: ConcallSummary = {
      id: `${sym}-pending`,
      ticker: sym,
      quarter: quarterLabel,
      bullets: [locMsg(locale, 'concallFallbackTranscriptNotFound'), hint],
      guidance: locMsg(locale, 'concallGuidanceEarningsDate', { date: row.date, hour: row.hour }),
      risk: undefined,
      source: 'fallback',
    };
    if (cacheEnabled) storeConcallCache(cacheKey, [summary]);
    return summary;
  }

  const snippet = clipTranscriptForDisplay(text, CONCALL_TRANSCRIPT_SNIPPET_MAX_CHARS);

  try {
    const summary = await summarizeConcallTranscriptSelected(sym, quarterLabel, text);
    const withSnippet: ConcallSummary = { ...summary, transcriptSnippet: snippet };
    if (cacheEnabled) storeConcallCache(cacheKey, [withSnippet]);
    return withSnippet;
  } catch {
    const summary: ConcallSummary = {
      id: `${sym}-err`,
      ticker: sym,
      quarter: quarterLabel,
      bullets: [locMsg(locale, 'concallFallbackSummaryFailed'), '—'],
      source: 'fallback',
      transcriptSnippet: snippet,
    };
    if (cacheEnabled) storeConcallCache(cacheKey, [summary]);
    return summary;
  }
}
