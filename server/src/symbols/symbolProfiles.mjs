const PARQET_LOGO_BASE = 'https://assets.parqet.com/logos/symbol';

function cleanText(value) {
  return String(value || '').trim();
}

export function normalizeSymbolDisplay(value) {
  const raw = cleanText(value).toUpperCase();
  if (!raw) return '';
  const kr = raw.match(/^(\d{6})\.(KS|KQ)$/);
  if (kr) return kr[1];
  const exchange = raw.match(/^([A-Z][A-Z0-9.\-]{0,11})\.(US|NYSE|NASDAQ|AMEX|NMS|NYQ)$/);
  if (exchange) return exchange[1];
  return raw;
}

export function detectSymbolMarket(symbol) {
  const display = normalizeSymbolDisplay(symbol);
  if (/^\d{6}$/.test(display)) return 'kr';
  if (/^[A-Z]/.test(display)) return 'global';
  return 'unknown';
}

/** Briefing `us` · quotes `korea` 등 → DB market (`kr` | `global`). */
export function normalizeSymbolMarket(market, symbol) {
  const raw = cleanText(market).toLowerCase();
  if (raw === 'kr' || raw === 'korea') return 'kr';
  if (raw === 'global' || raw === 'us' || raw === 'usa' || raw === 'nyse' || raw === 'nasdaq') {
    return 'global';
  }
  return detectSymbolMarket(symbol);
}

export function symbolLogoUrl(symbol, preferredUrl = null) {
  const preferred = cleanText(preferredUrl);
  if (/^https?:\/\//i.test(preferred)) return preferred;
  const display = normalizeSymbolDisplay(symbol);
  if (!display) return null;
  if (/^\d{6}$/.test(display)) return `${PARQET_LOGO_BASE}/${encodeURIComponent(`${display}.KS`)}`;
  if (/^[A-Z][A-Z0-9.\-]{0,11}$/.test(display)) return `${PARQET_LOGO_BASE}/${encodeURIComponent(display)}`;
  return null;
}

export function isUsableDisplayName(name, symbol) {
  const label = cleanText(name);
  const display = normalizeSymbolDisplay(symbol);
  if (!label || !display) return false;
  const upper = label.toUpperCase();
  if (upper === display) return false;
  if (normalizeSymbolDisplay(label) === display) return false;
  if (/^\d{6}(\.(KS|KQ))?$/.test(upper)) return false;
  return true;
}

export function buildSymbolProfile(row = {}) {
  const symbol = normalizeSymbolDisplay(
    row.symbol ||
      row.displaySymbol ||
      row.krxSymbol ||
      row.providerItemId ||
      row.ticker ||
      row.stockCode,
  );
  if (!symbol) return null;
  const name = isUsableDisplayName(row.name || row.companyName || row.displayName, symbol)
    ? cleanText(row.name || row.companyName || row.displayName)
    : null;
  const market = normalizeSymbolMarket(row.market, symbol);
  const logoUrl = symbolLogoUrl(symbol, row.imageUrl || row.logoUrl || row.profileImageUrl || null);
  return {
    symbolKey: `${market}:${symbol}`,
    market,
    symbol,
    displaySymbol: symbol,
    name,
    exchange: cleanText(row.exchange) || null,
    logoUrl,
    payload: {
      source: cleanText(row.source) || null,
      aliases: Array.isArray(row.aliases) ? row.aliases.filter(Boolean) : [],
    },
  };
}

export function publicSymbolMeta(profile = {}) {
  const symbol = normalizeSymbolDisplay(profile.symbol || profile.displaySymbol);
  if (!symbol) return null;
  const logoPreferred = cleanText(profile.logoUrl || null);
  return {
    market: normalizeSymbolMarket(profile.market, symbol),
    symbol,
    displaySymbol: normalizeSymbolDisplay(profile.displaySymbol || symbol),
    name: isUsableDisplayName(profile.name, symbol) ? cleanText(profile.name) : null,
    // Serve stored URL only — do not invent Parqet at read time.
    logoUrl: /^https?:\/\//i.test(logoPreferred) ? logoPreferred : null,
  };
}
