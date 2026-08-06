import { upsertSymbolProfilesRows } from '../db/repositories/symbolProfilesRepository.mjs';

const INGEST_PROFILE_COLLECTIONS = new Set(['marketQuotes', 'disclosures', 'marketBriefings']);

/**
 * Upsert symbol_profiles from ingest collection rows (write-time only).
 * News / ETF insights are enrich-only and are not written here.
 */
export async function upsertSymbolProfilesFromIngest(client, collectionKey, rows = []) {
  if (!INGEST_PROFILE_COLLECTIONS.has(collectionKey)) return { count: 0 };
  const safeRows = Array.isArray(rows) ? rows : [];
  const symbolRows =
    collectionKey === 'marketBriefings'
      ? safeRows.flatMap((row) => (Array.isArray(row?.companies) ? row.companies : []))
      : safeRows;
  if (symbolRows.length === 0) return { count: 0 };
  await upsertSymbolProfilesRows(client, symbolRows);
  return { count: symbolRows.length };
}
