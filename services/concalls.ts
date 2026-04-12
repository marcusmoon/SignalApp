import {
  MEGA_CAP_SET,
  megaCapRank,
  normalizeEarningsSymbolForMatch,
  normalizeMegaCapTicker,
} from '@/constants/megaCapUniverse';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import { calendarRangeForFiscalYear } from '@/services/concallFiscalFilter';
import { fetchEarningsCallTranscript } from '@/services/apiNinjas';
import { summarizeConcallTranscriptSelected } from '@/services/aiSummaries';
import { fetchEarningsCalendarRangeMerged, type FinnhubEarningsRow } from '@/services/finnhub';
import {
  buildConcallCacheKey,
  deleteConcallCache,
  peekConcallCache,
  storeConcallCache,
} from '@/integrations/concalls/cache';
import { hasApiNinjas, hasFinnhub } from '@/services/env';
import type { ConcallSummary } from '@/types/signal';
import { addDays } from '@/utils/date';

/** Finnhub `date` (YYYY-MM-DD) 로컬 자정 기준 */
function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function isEarningsDateInFuture(ymd: string): boolean {
  const t = parseYmdLocal(ymd).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t > today.getTime();
}

function sortRowsForTranscript(rows: FinnhubEarningsRow[], useMegaRank: boolean): FinnhubEarningsRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...rows].sort((a, b) => {
    const da = parseYmdLocal(a.date).getTime();
    const db = parseYmdLocal(b.date).getTime();
    const aPast = da <= today.getTime();
    const bPast = db <= today.getTime();
    if (aPast !== bPast) return aPast ? -1 : 1;
    if (useMegaRank) {
      const ra = megaCapRank(a.symbol);
      const rb = megaCapRank(b.symbol);
      if (ra !== rb) return ra - rb;
    }
    if (da !== db) return da - db;
    return a.symbol.localeCompare(b.symbol);
  });
}

const TRANSCRIPT_SNIPPET_MAX = 14_000;

function clipTranscriptForDisplay(raw: string, maxChars: number): string {
  const t = raw.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars).trimEnd()}…`;
}

function concallNinjaHint(ninjasStatus: number, row: FinnhubEarningsRow | undefined): string {
  if (!hasApiNinjas()) {
    return '트랜스크립트용 키(EXPO_PUBLIC_API_NINJAS_KEY)가 비어 있습니다. .env에 넣고 Metro를 재시작하세요.';
  }
  if (ninjasStatus === 401) {
    return '인증에 실패했습니다(401). 키가 올바른지 확인하세요.';
  }
  if (ninjasStatus === 403) {
    return '접근이 거부되었습니다(403). 실적콜 트랜스크립트는 유료 전용일 수 있습니다. 구독·권한을 확인하세요.';
  }
  if (ninjasStatus === 429) {
    return '요청 한도에 도달했습니다(429). 잠시 후 다시 시도하세요.';
  }
  if (ninjasStatus === 404) {
    return '요청한 티커·분기 조합을 찾지 못했습니다. DB에 없거나 다른 분기만 제공될 수 있습니다.';
  }
  if (row) {
    if (isEarningsDateInFuture(row.date)) {
      return '이 일정은 아직 발표 전(또는 콜 직후 미반영)일 수 있습니다. 트랜스크립트는 실적콜이 끝난 뒤에 제공되는 경우가 많습니다.';
    }
    if (ninjasStatus === 200) {
      return '발표일은 지났는데도 없으면, 이 티커·분기 조합이 없거나(소형·일부 종목), 아직 업로드되지 않았을 수 있습니다. 대형주 위주로 커버되는 경우가 많습니다.';
    }
  }
  return '네트워크와 API 키를 확인하세요. 테스트 시 AAPL·MSFT 등 대형주로 바꿔 보세요.';
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
};

function normalizeWatchSet(symbols: string[] | undefined): Set<string> {
  return new Set(
    (symbols ?? [])
      .map((s) => normalizeMegaCapTicker(s.trim().toUpperCase()))
      .filter((s) => s.length > 0),
  );
}

function pickSymbolsFromRows(rows: FinnhubEarningsRow[], maxItems: number): string[] {
  return Array.from(
    new Set(
      rows
        .map((r) => r.symbol)
        .filter(Boolean)
        .slice(0, maxItems * 2),
    ),
  ).slice(0, maxItems);
}

function rowMatchesFiscalSelection(
  r: FinnhubEarningsRow,
  fiscalYear: number,
  fiscalQuarter: 0 | 1 | 2 | 3 | 4,
): boolean {
  const y = String(fiscalYear);
  const inCalendarYear = r.date >= `${y}-01-01` && r.date <= `${y}-12-31`;
  const inFiscalYearField = r.year === fiscalYear;
  const yearOk = inCalendarYear || inFiscalYearField;
  if (!yearOk) return false;
  if (fiscalQuarter === 0) return true;
  return r.quarter === fiscalQuarter;
}

export async function fetchConcallSummaries(
  maxItemsParam = 3,
  options?: FetchConcallSummariesOptions,
): Promise<ConcallSummary[]> {
  if (!hasFinnhub()) {
    throw new Error('FINNHUB_TOKEN_MISSING');
  }
  const scope = options?.scope ?? 'mega';
  const watchSet = normalizeWatchSet(options?.watchlistSymbols);
  const watchSorted = [...watchSet].sort();
  const fiscalYearForKey = options?.fiscalYear != null ? options.fiscalYear : null;
  const useFiscal = fiscalYearForKey != null;
  const fiscalQuarterForKey = options?.fiscalQuarter ?? 0;
  const symbolCap = useFiscal ? 10 : maxItemsParam;
  const rollPast = options?.rollingEarningsPastDays;
  const rollFuture = options?.rollingEarningsFutureDays;
  const cacheKey = buildConcallCacheKey({
    symbolCap,
    scope,
    watchSorted: scope === 'watch' ? watchSorted : [],
    fiscalYear: fiscalYearForKey,
    fiscalQuarter: fiscalQuarterForKey,
    rollingPastDays: rollPast,
    rollingFutureDays: rollFuture,
  });

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
  rows = sortRowsForTranscript(rows, scope === 'mega');

  const symbols = pickSymbolsFromRows(rows, cap);

  const out: ConcallSummary[] = [];

  if (symbols.length === 0) {
    if (scope === 'watch') {
      if (cacheEnabled) storeConcallCache(cacheKey, []);
      return [];
    }
    const fqLabel =
      useFiscal && fiscalQuarter > 0 ? `Q${fiscalQuarter}` : '전체';
    const emptyCal: ConcallSummary[] = [
      {
        id: 'empty-cal',
        ticker: '—',
        quarter: '—',
        bullets: useFiscal
          ? [
              `FY${fiscalYear} ${fqLabel}에 해당하는 Finnhub 실적 일정이 없습니다(메가캡 목록과 교집합).`,
              'Finnhub 무료 플랜은 과거 구간 일정이 비거나 제한될 수 있습니다. 최근 연도·전체 분기로 조회해 보세요.',
            ]
          : [
              '해당 기간에 메가캡 목록과 겹치는 Finnhub 실적 일정이 없습니다.',
              '토큰 권한을 확인하거나 필터에서 연도·분기를 조회해 보세요.',
            ],
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

    const quarterLabel = row ? `FY${row.year} Q${row.quarter}` : '최근';

    if (!text || text.length < 200) {
      const hint = concallNinjaHint(ninjasStatus, row);

      out.push({
        id: `${sym}-pending`,
        ticker: sym,
        quarter: quarterLabel,
        bullets: ['해당 티커의 실적콜 트랜스크립트를 찾지 못했습니다.', hint],
        guidance: row ? `예정/발표일: ${row.date} (${row.hour})` : undefined,
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
        bullets: ['요약 중 오류가 발생했습니다.', '—'],
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
  options?: { forceRefresh?: boolean; cacheEnabled?: boolean },
): Promise<ConcallSummary> {
  if (!hasFinnhub()) {
    throw new Error('FINNHUB_TOKEN_MISSING');
  }
  const sym = ticker.trim().toUpperCase();
  const cacheKey = `v1|single|${normalizeEarningsSymbolForMatch(sym)}|${row.year}|${row.quarter}|${row.date}`;
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

  const quarterLabel = `FY${row.year} Q${row.quarter}`;

  if (!text || text.length < 200) {
    const hint = concallNinjaHint(ninjasStatus, row);
    const summary: ConcallSummary = {
      id: `${sym}-pending`,
      ticker: sym,
      quarter: quarterLabel,
      bullets: ['해당 티커의 실적콜 트랜스크립트를 찾지 못했습니다.', hint],
      guidance: `예정/발표일: ${row.date} (${row.hour})`,
      risk: undefined,
      source: 'fallback',
    };
    if (cacheEnabled) storeConcallCache(cacheKey, [summary]);
    return summary;
  }

  const snippet = clipTranscriptForDisplay(text, TRANSCRIPT_SNIPPET_MAX);

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
      bullets: ['요약 중 오류가 발생했습니다.', '—'],
      source: 'fallback',
      transcriptSnippet: snippet,
    };
    if (cacheEnabled) storeConcallCache(cacheKey, [summary]);
    return summary;
  }
}
