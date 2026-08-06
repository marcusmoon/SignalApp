import {
  fetchSymbolProfilesForInputs,
  resolvePublicSymbolMeta,
  symbolProfileLookupKeys,
} from '../db/repositories/symbolProfilesRepository.mjs';

/**
 * Batch-attach `symbolMeta` from registered `symbol_profiles` only.
 * Missing profiles stay null (no on-read insert).
 *
 * @param {object[]} items
 * @param {(item: object) => object|null|undefined} getIdentity
 *   Returns lookup fields `{ market?, symbol, displaySymbol?, … }` or null to skip.
 * @param {(item: object, symbolMeta: object|null) => object} [mapItem]
 *   Defaults to `{ ...item, symbolMeta }`.
 */
export async function enrichItemsWithSymbolMeta(items = [], getIdentity, mapItem) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return list;

  const identities = list.map((item) => {
    const identity = typeof getIdentity === 'function' ? getIdentity(item) : null;
    if (!identity || typeof identity !== 'object') return null;
    return identity;
  });
  const inputs = identities.filter(Boolean);
  if (inputs.length === 0) return list;

  const profiles = await fetchSymbolProfilesForInputs(inputs);
  const apply =
    typeof mapItem === 'function'
      ? mapItem
      : (item, symbolMeta) => ({ ...item, symbolMeta });

  return list.map((item, index) => {
    const identity = identities[index];
    if (!identity) return item;
    const profile =
      symbolProfileLookupKeys(identity)
        .map((key) => profiles.get(key))
        .find(Boolean) || null;
    return apply(item, resolvePublicSymbolMeta(profile), { identity, profiles, profile });
  });
}

/**
 * Like enrichItemsWithSymbolMeta but also returns the profiles map for overlays
 * (e.g. home index logo proxies).
 */
export async function loadSymbolProfilesForItems(items = [], getIdentity) {
  const list = Array.isArray(items) ? items : [];
  const identities = list.map((item) => {
    const identity = typeof getIdentity === 'function' ? getIdentity(item) : null;
    if (!identity || typeof identity !== 'object') return null;
    return identity;
  });
  const inputs = identities.filter(Boolean);
  const profiles = inputs.length > 0 ? await fetchSymbolProfilesForInputs(inputs) : new Map();
  return { list, identities, profiles };
}

export function symbolMetaFromProfiles(identity, profiles) {
  if (!identity || !profiles) return null;
  const profile =
    symbolProfileLookupKeys(identity)
      .map((key) => profiles.get(key))
      .find(Boolean) || null;
  return resolvePublicSymbolMeta(profile);
}
