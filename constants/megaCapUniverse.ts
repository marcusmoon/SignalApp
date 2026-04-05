/**
 * 시장에서 말하는 메가캡에 가까운 미국 대형주 유니버스(큐레이션).
 * 설정에서 「메가캡만」을 켠 경우에만 캘린더·컨콜 실적 후보를 이 목록으로 제한합니다.
 */
export const MEGA_CAP_TICKERS = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'GOOG',
  'AMZN',
  'NVDA',
  'META',
  'TSLA',
  'BRK.B',
  'AVGO',
  'UNH',
  'XOM',
  'JNJ',
  'JPM',
  'V',
  'PG',
  'MA',
  'HD',
  'CVX',
  'MRK',
  'ABBV',
  'PEP',
  'COST',
  'ADBE',
  'TMO',
  'CSCO',
  'ACN',
  'NFLX',
  'DHR',
  'LIN',
  'AMD',
  'MCD',
  'WMT',
  'DIS',
  'ORCL',
  'BAC',
  'CRM',
  'PM',
  'INTU',
  'TXN',
  'QCOM',
  'IBM',
  'AMAT',
  'COP',
  'GE',
  'HON',
  'CAT',
  'AMGN',
  'SPGI',
  'BKNG',
  'BLK',
  'SBUX',
  'GILD',
  'ISRG',
  'MDT',
  'ADI',
  'VRTX',
  'PANW',
  'MU',
  'LRCX',
  'SYK',
  'DE',
  'REGN',
  'ZTS',
  'ETN',
  'KLAC',
  'SNPS',
  'CDNS',
  'MELI',
  'CMCSA',
] as const;

export const MEGA_CAP_SET = new Set<string>(MEGA_CAP_TICKERS);

const FINNHUB_ALIAS_TO_CANONICAL: Record<string, string> = {
  'BRK-B': 'BRK.B',
};

export function normalizeMegaCapTicker(sym: string): string {
  const u = sym.trim().toUpperCase();
  return FINNHUB_ALIAS_TO_CANONICAL[u] ?? u;
}

/** Finnhub가 AAPL.US · BRK-B 등으로 줄 때 메가캡 세트·관심종목과 맞춤 */
export function normalizeEarningsSymbolForMatch(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  const noUs = s.endsWith('.US') ? s.slice(0, -3) : s;
  return normalizeMegaCapTicker(noUs);
}

/** 낮을수록 먼저 노출(배열이 시총 상위에 가깝게 정렬됨) */
export function megaCapRank(symbol: string): number {
  const u = normalizeMegaCapTicker(symbol);
  const i = (MEGA_CAP_TICKERS as readonly string[]).indexOf(u);
  return i === -1 ? 9999 : i;
}
