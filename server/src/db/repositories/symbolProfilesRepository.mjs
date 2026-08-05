import { queryKysely } from '../kysely/client.mjs';
import { cleanText, payloadFromRow } from './publicHelpers.mjs';
import {
  buildSymbolProfile,
  normalizeSymbolDisplay,
  normalizeSymbolMarket,
  publicSymbolMeta,
} from '../../symbols/symbolProfiles.mjs';

function keyFor(market, symbol) {
  const display = normalizeSymbolDisplay(symbol);
  if (!display) return '';
  const resolvedMarket = normalizeSymbolMarket(market, display);
  if (resolvedMarket === 'unknown') return '';
  return `${resolvedMarket}:${display}`;
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
 * Look up registered profiles only. Missing keys stay missing (no auto-insert)
 * so Admin/ingest can fill them later.
 */
export async function fetchSymbolProfilesForInputs(inputs = []) {
  const keys = [
    ...new Set(
      (Array.isArray(inputs) ? inputs : []).flatMap((input) => symbolProfileLookupKeys(input)),
    ),
  ];
  if (keys.length === 0) return new Map();
  return fetchSymbolProfilesByKeys(keys);
}

/** DB profile only — no synthetic row when unregistered. */
export function resolvePublicSymbolMeta(profile = null) {
  if (!profile) return null;
  return publicSymbolMeta(profile);
}
