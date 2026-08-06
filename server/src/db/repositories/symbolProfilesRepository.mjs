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

function safeIsoTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safePayload(row) {
  try {
    const payload = payloadFromRow(row);
    if (!payload) return null;
    // Ensure admin JSON responses never trip on non-JSON-safe driver values.
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return null;
  }
}

export function rowToProfile(row) {
  return {
    symbolKey: cleanText(row.symbol_key),
    market: cleanText(row.market),
    symbol: cleanText(row.symbol),
    displaySymbol: cleanText(row.display_symbol),
    name: cleanText(row.name) || null,
    exchange: cleanText(row.exchange) || null,
    logoUrl: cleanText(row.logo_url) || null,
    payload: safePayload(row),
    updatedAt: safeIsoTimestamp(row.updated_at),
  };
}

export async function listSymbolProfiles(options = {}) {
  const q = cleanText(options.q).toLowerCase();
  const marketRaw = cleanText(options.market).toLowerCase();
  const market = marketRaw === 'kr' || marketRaw === 'global' ? marketRaw : '';
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const filterParams = [];
  const where = [];
  if (market) {
    filterParams.push(market);
    where.push(`market = $${filterParams.length}`);
  }
  if (q) {
    filterParams.push(`%${q}%`);
    const idx = filterParams.length;
    where.push(`(
      lower(symbol_key) LIKE $${idx}
      OR lower(symbol) LIKE $${idx}
      OR lower(display_symbol) LIKE $${idx}
      OR lower(COALESCE(name, '')) LIKE $${idx}
    )`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await queryKysely(
    `SELECT count(*)::bigint AS n FROM symbol_profiles ${whereSql}`,
    filterParams,
  );
  const total = Number(countResult.rows[0]?.n) || 0;
  const listParams = [...filterParams, limit, offset];
  const limitIdx = listParams.length - 1;
  const offsetIdx = listParams.length;
  const result = await queryKysely(
    `
      SELECT symbol_key, market, symbol, display_symbol, name, exchange, logo_url, payload, updated_at
      FROM symbol_profiles
      ${whereSql}
      ORDER BY market ASC, display_symbol ASC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listParams,
  );
  const rows = [];
  for (const row of result.rows) {
    try {
      const profile = rowToProfile(row);
      // Admin list UI does not need payload; drop it to keep the response JSON-safe/small.
      rows.push({
        symbolKey: profile.symbolKey,
        market: profile.market,
        symbol: profile.symbol,
        displaySymbol: profile.displaySymbol,
        name: profile.name,
        exchange: profile.exchange,
        logoUrl: profile.logoUrl,
        updatedAt: profile.updatedAt,
      });
    } catch (error) {
      console.error('[symbol_profiles] skip bad row', row?.symbol_key, error);
    }
  }
  return {
    rows,
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  };
}

export async function getSymbolProfileByKey(symbolKey) {
  const key = cleanText(symbolKey);
  if (!key) return null;
  const result = await queryKysely(
    `
      SELECT symbol_key, market, symbol, display_symbol, name, exchange, logo_url, payload, updated_at
      FROM symbol_profiles
      WHERE symbol_key = $1
    `,
    [key],
  );
  const row = result.rows[0];
  return row ? rowToProfile(row) : null;
}

/**
 * Admin create/update. Empty logoUrl still gets Parqet via buildSymbolProfile
 * so curated rows ship a usable image URL.
 */
export async function saveSymbolProfileAdmin(input = {}) {
  const profile = buildSymbolProfile({
    ...input,
    source: cleanText(input.source) || 'admin',
  });
  if (!profile?.symbolKey) throw new Error('SYMBOL_PROFILE_SYMBOL_REQUIRED');
  if (profile.market !== 'kr' && profile.market !== 'global') {
    throw new Error('SYMBOL_PROFILE_MARKET_INVALID');
  }
  await upsertSymbolProfilesRows(dbWriteClient(), [
    {
      ...input,
      market: profile.market,
      symbol: profile.symbol,
      displaySymbol: profile.displaySymbol,
      name: profile.name,
      exchange: profile.exchange,
      logoUrl: profile.logoUrl,
      imageUrl: profile.logoUrl,
      source: 'admin',
    },
  ]);
  return getSymbolProfileByKey(profile.symbolKey);
}

export async function deleteSymbolProfileByKey(symbolKey) {
  const key = cleanText(symbolKey);
  if (!key) throw new Error('SYMBOL_PROFILE_KEY_REQUIRED');
  const result = await queryKysely('DELETE FROM symbol_profiles WHERE symbol_key = $1 RETURNING symbol_key', [key]);
  if (!result.rows[0]) throw new Error('SYMBOL_PROFILE_NOT_FOUND');
  return { symbolKey: key, deleted: true };
}
