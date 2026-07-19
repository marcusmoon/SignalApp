const PARQET_LOGO_BASE = 'https://assets.parqet.com/logos/symbol';

function isKoreaStockCode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

/**
 * 로고·국장 판별용 베이스 티커.
 * 브리핑 ingest가 `005930.KS`처럼 Yahoo 접미사를 붙인 경우 제거한다.
 * `BRK.B` 같은 클래스 주식 접미사는 유지한다.
 */
export function logoBaseSymbol(symbol: string): string {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw || raw === '—' || raw === 'GLOBAL') return '';
  const kr = raw.match(/^(\d{6})\.(KS|KQ)$/);
  if (kr) return kr[1];
  const exchange = raw.match(/^([A-Z][A-Z0-9.\-]{0,11})\.(US|NYSE|NASDAQ|AMEX|NMS|NYQ)$/);
  if (exchange) return exchange[1];
  return raw;
}

const failedLogoKeys = new Set<string>();

function logoCacheKey(symbol: string, url: string): string {
  return `${logoBaseSymbol(symbol) || symbol.trim().toUpperCase()}|${url}`;
}

function parqetLogoUrl(ticker: string): string {
  return `${PARQET_LOGO_BASE}/${encodeURIComponent(ticker)}`;
}

export function markSymbolLogoFailed(symbol: string, url: string): void {
  failedLogoKeys.add(logoCacheKey(symbol, url));
}

export function isSymbolLogoFailed(symbol: string, url: string): boolean {
  return failedLogoKeys.has(logoCacheKey(symbol, url));
}

function isHttpLogoUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * 로고 후보 URL.
 * - `preferredUrls`: 서버 제공 (코인 CoinGecko `imageUrl` 등) — Parqet보다 우선
 * - 이어서 Parqet (국장 .KS → .KQ). `005930.KS` 입력도 국장으로 인식.
 */
export function symbolLogoUrls(
  symbol: string,
  preferredUrls?: Array<string | null | undefined>,
): string[] {
  const sym = logoBaseSymbol(symbol);
  if (!sym) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    if (!url || seen.has(url) || isSymbolLogoFailed(sym, url)) return;
    seen.add(url);
    out.push(url);
  };

  for (const raw of preferredUrls || []) {
    const url = String(raw || '').trim();
    if (isHttpLogoUrl(url)) push(url);
  }

  if (isKoreaStockCode(sym)) {
    for (const ticker of [`${sym}.KS`, `${sym}.KQ`]) {
      push(parqetLogoUrl(ticker));
    }
    return out;
  }

  if (/^[A-Z][A-Z0-9.\-]{0,11}$/.test(sym)) {
    push(parqetLogoUrl(sym));
  }
  return out;
}

/** 첫 번째 로고 URL (기존 호출부 호환) */
export function symbolLogoUrl(symbol: string, preferredUrl?: string | null): string | null {
  return symbolLogoUrls(symbol, preferredUrl ? [preferredUrl] : undefined)[0] ?? null;
}
