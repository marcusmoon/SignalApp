import { normalizeDisplaySymbol } from '../domain/symbols/symbolIdentity.ts';

/**
 * 로고·국장 판별용 베이스 티커 — `normalizeDisplaySymbol`과 동일.
 * (`005930.KS` → `005930`, `BRK.B` 유지)
 */
export function logoBaseSymbol(symbol: string): string {
  return normalizeDisplaySymbol(symbol);
}

const failedLogoKeys = new Set<string>();

function logoCacheKey(symbol: string, url: string): string {
  return `${logoBaseSymbol(symbol) || symbol.trim().toUpperCase()}|${url}`;
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
 * 로고 후보 URL — 서버가 준 URL만 사용한다.
 * (`symbolMeta.logoUrl` · 코인 `imageUrl` · FX 국기 등)
 * 없으면 빈 배열 → UI는 글자 아바타. 클라이언트에서 Parqet 등을 합성하지 않는다.
 */
export function symbolLogoUrls(
  symbol: string,
  preferredUrls?: Array<string | null | undefined>,
): string[] {
  const sym = logoBaseSymbol(symbol);
  const cacheKeyBase = sym || String(symbol || '').trim().toUpperCase();
  if (!cacheKeyBase && !(preferredUrls || []).some((raw) => isHttpLogoUrl(String(raw || '').trim()))) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    if (!url || seen.has(url) || isSymbolLogoFailed(cacheKeyBase || url, url)) return;
    seen.add(url);
    out.push(url);
  };

  for (const raw of preferredUrls || []) {
    const url = String(raw || '').trim();
    if (isHttpLogoUrl(url)) push(url);
  }

  return out;
}

/** 첫 번째 로고 URL (기존 호출부 호환) */
export function symbolLogoUrl(symbol: string, preferredUrl?: string | null): string | null {
  return symbolLogoUrls(symbol, preferredUrl ? [preferredUrl] : undefined)[0] ?? null;
}
