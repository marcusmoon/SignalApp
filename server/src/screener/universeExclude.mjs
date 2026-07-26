/**
 * KR universe exclusion helpers (preferred, SPAC, admin/halt heuristics).
 * Name patterns alone can miss preferred shares — also check code suffix heuristics.
 */

function cleanText(value) {
  return String(value || '').trim();
}

/** Common preferred-share name endings / tokens (KR). */
const PREFERRED_NAME_RE =
  /(우B?$|우선주|우선|1우|2우|3우|\(우\)|우\d*$)/i;

/** SPAC / blank-check style names. */
const SPAC_NAME_RE = /(스팩|SPAC|기업인수목적)/i;

/** Admin / delisting / halt style labels when present on quote. */
const ADMIN_NAME_RE = /(관리종목|정리매매|거래정지|투자주의|투자경고|투자위험|상장폐지)/i;

/**
 * Prefer ordinary shares: KR preferred codes often end with non-zero 5th digit patterns
 * (e.g. 005935) — treat trailing 5/7/8/9 in last digit of 6-digit as preferred heuristic
 * when name also looks preferred, or when name matches preferred pattern alone.
 */
export function isLikelyPreferredShare(symbol, name) {
  const code = cleanText(symbol).replace(/\.(KS|KQ)$/i, '');
  const label = cleanText(name);
  if (PREFERRED_NAME_RE.test(label)) return true;
  // Explicit preferred code heuristics used by KRX listings (common pattern).
  if (/^\d{6}$/.test(code) && /[5-9]$/.test(code) && /우/.test(label)) return true;
  return false;
}

export function isLikelySpac(symbol, name) {
  return SPAC_NAME_RE.test(cleanText(name));
}

export function isLikelyRestrictedListing(quote, name) {
  const label = cleanText(name || quote?.name);
  if (ADMIN_NAME_RE.test(label)) return true;
  const flags = [
    quote?.halted,
    quote?.tradingHalt,
    quote?.isHalted,
    quote?.suspended,
    quote?.adminIssue,
    quote?.managementStock,
    quote?.caution,
  ];
  if (flags.some((v) => v === true)) return true;
  const status = cleanText(quote?.listingStatus || quote?.tradeStatus || quote?.status).toLowerCase();
  if (!status) return false;
  return /halt|suspend|admin|delist|관리|정지|정리/.test(status);
}

/**
 * @returns {{ exclude: boolean, reason: string|null }}
 */
export function shouldExcludeFromKrUniverse({ symbol, name, quote } = {}) {
  if (isLikelyPreferredShare(symbol, name)) {
    return { exclude: true, reason: 'preferred' };
  }
  if (isLikelySpac(symbol, name)) {
    return { exclude: true, reason: 'spac' };
  }
  if (isLikelyRestrictedListing(quote, name)) {
    return { exclude: true, reason: 'restricted' };
  }
  return { exclude: false, reason: null };
}
