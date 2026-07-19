const PARQET_LOGO_BASE = 'https://assets.parqet.com/logos/symbol';

function isKoreaStockCode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

const failedLogoKeys = new Set<string>();

function logoCacheKey(symbol: string, url: string): string {
  return `${symbol.trim().toUpperCase()}|${url}`;
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
 * - 이어서 Parqet (국장 .KS → .KQ)
 */
export function symbolLogoUrls(
  symbol: string,
  preferredUrls?: Array<string | null | undefined>,
): string[] {
  const sym = symbol.trim().toUpperCase();
  if (!sym || sym === '—' || sym === 'GLOBAL') return [];

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
