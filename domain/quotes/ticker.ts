export function normalizeUsTickerSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** 미국 티커 형태만 허용 (예: BRK.B, SPY) */
export function isValidUsTicker(s: string): boolean {
  const t = normalizeUsTickerSymbol(s);
  return t.length > 0 && t.length <= 12 && /^[A-Z0-9.\-]+$/.test(t);
}
