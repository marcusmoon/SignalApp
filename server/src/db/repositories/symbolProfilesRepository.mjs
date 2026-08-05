import { queryKysely } from '../kysely/client.mjs';
import { cleanText, payloadFromRow } from './publicHelpers.mjs';
import {
  buildSymbolProfile,
  normalizeSymbolDisplay,
  normalizeSymbolMarket,
  publicSymbolMeta,
} from '../../symbols/symbolProfiles.mjs';

/** Process-local: avoid re-upserting the same key on every enrich within a short window. */
const ensuredKeys = new Set();

function keyFor(market, symbol) {
  const display = normalizeSymbolDisplay(symbol);
  if (!display) return '';
  const resolvedMarket = normalizeSymbolMarket(market, display);
  if (resolvedMarket === 'unknown') return '';
  return `${resolvedMarket}:${display}`;
}

function dbWriteClient() {
  return { query: (text, params) => queryKysely(text, params) };
}

export async function upsertSymbolProfilesRows(client, rows = []) {
  const seen = new Set();
  for (const input of Array.isArray(rows) ? rows : []) {
    const profile = buildSymbolProfile(input);
    if (!profile?.symbolKey || seen.has(profile.symbolKey)) continue;
    seen.add(profile.symbolKey);
    await client.query(
      `
        INSERT INTO symbol_profiles (
          symbol_key,
          market,
          symbol,
          display_symbol,
          name,
          exchange,
          logo_url,
          payload,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
        ON CONFLICT(symbol_key) DO UPDATE SET
          display_symbol = excluded.display_symbol,
          name = COALESCE(excluded.name, symbol_profiles.name),
          exchange = COALESCE(excluded.exchange, symbol_profiles.exchange),
          logo_url = COALESCE(excluded.logo_url, symbol_profiles.logo_url),
          payload = CASE
            WHEN symbol_profiles.payload IS NULL OR symbol_profiles.payload = '{}'::jsonb THEN excluded.payload
            WHEN excluded.payload IS NULL OR excluded.payload = '{}'::jsonb THEN symbol_profiles.payload
            ELSE symbol_profiles.payload || excluded.payload
          END,
          updated_at = excluded.updated_at
      `,
      [
        profile.symbolKey,
        profile.market,
        profile.symbol,
        profile.displaySymbol,
        profile.name,
        profile.exchange,
        profile.logoUrl,
        JSON.stringify(profile.payload || {}),
      ],
    );
  }
}

export async function fetchSymbolProfilesByKeys(keys = []) {
  const safeKeys = [...new Set((Array.isArray(keys) ? keys : []).map((key) => cleanText(key)).filter(Boolean))];
  const map = new Map();
  if (safeKeys.length === 0) return map;
  const result = await queryKysely(
    'SELECT symbol_key, market, symbol, display_symbol, name, exchange, logo_url, payload FROM symbol_profiles WHERE symbol_key = ANY($1::text[])',
    [safeKeys],
  );
  for (const row of result.rows) {
    map.set(cleanText(row.symbol_key), {
      symbolKey: cleanText(row.symbol_key),
      market: cleanText(row.market),
      symbol: cleanText(row.symbol),
      displaySymbol: cleanText(row.display_symbol),
      name: cleanText(row.name) || null,
      exchange: cleanText(row.exchange) || null,
      logoUrl: cleanText(row.logo_url) || null,
      payload: payloadFromRow(row) || null,
    });
  }
  return map;
}

export function symbolProfileLookupKeys(input = {}) {
  const candidates = [
    { market: input.market, symbol: input.symbol },
    { market: input.market, symbol: input.displaySymbol },
    { market: input.market, symbol: input.krxSymbol },
    { market: input.market, symbol: input.providerItemId },
    { market: 'kr', symbol: input.krxSymbol },
    { market: 'global', symbol: input.symbol },
  ];
  return [...new Set(candidates.map((item) => keyFor(item.market, item.symbol)).filter(Boolean))];
}

/**
 * Fetch profiles; upsert any missing equity/ETF tickers so later reads hit DB.
 * Ticker-only rows get name=null and a synthesized Parqet logoUrl.
 * Coins are not registered here (CoinGecko imageUrl path).
 */
export async function ensureSymbolProfilesForKeys(inputs = []) {
  const built = [];
  const seenBuild = new Set();
  for (const input of Array.isArray(inputs) ? inputs : []) {
    const profile = buildSymbolProfile({
      ...input,
      source: input?.source || 'ensure',
    });
    if (!profile?.symbolKey || seenBuild.has(profile.symbolKey)) continue;
    // Skip unknown markets (non equity-like) — do not invent coin/index rows here.
    if (profile.market !== 'kr' && profile.market !== 'global') continue;
    seenBuild.add(profile.symbolKey);
    built.push(profile);
  }
  if (built.length === 0) return new Map();

  const keys = [...new Set(built.map((row) => row.symbolKey))];
  const profiles = await fetchSymbolProfilesByKeys(keys);

  const missing = built.filter((row) => {
    if (profiles.has(row.symbolKey)) return false;
    if (ensuredKeys.has(row.symbolKey)) return false;
    return true;
  });

  if (missing.length > 0) {
    await upsertSymbolProfilesRows(dbWriteClient(), missing);
    for (const row of missing) {
      ensuredKeys.add(row.symbolKey);
      profiles.set(row.symbolKey, {
        symbolKey: row.symbolKey,
        market: row.market,
        symbol: row.symbol,
        displaySymbol: row.displaySymbol,
        name: row.name,
        exchange: row.exchange,
        logoUrl: row.logoUrl,
        payload: row.payload || null,
      });
    }
  }

  return profiles;
}

export function resolvePublicSymbolMeta(input = {}, profile = null) {
  if (profile) return publicSymbolMeta(profile);
  return publicSymbolMeta({
    market: input.market,
    symbol: input.symbol || input.displaySymbol || input.krxSymbol,
    displaySymbol: input.displaySymbol || input.symbol || input.krxSymbol,
    name: input.name || input.companyName || null,
    logoUrl: input.imageUrl || null,
  });
}

/** Test helper — clear process-local ensure cache. */
export function _resetEnsuredSymbolProfileKeysForTests() {
  ensuredKeys.clear();
}
