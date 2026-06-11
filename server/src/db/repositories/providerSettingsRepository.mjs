import { getKyselyDb, sql } from '../kysely/client.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function payloadFromRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return payload && typeof payload === 'object' ? payload : null;
}

export async function findProviderSetting(provider) {
  const id = cleanText(provider);
  if (!id) return null;
  const row = await getKyselyDb()
    .selectFrom('provider_settings')
    .select('payload')
    .where('provider', '=', id)
    .executeTakeFirst();
  return payloadFromRow(row);
}

export async function findProviderSettings(providers = []) {
  const ids = [...new Set((Array.isArray(providers) ? providers : []).map(cleanText).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await getKyselyDb()
    .selectFrom('provider_settings')
    .select(['provider', 'payload'])
    .where('provider', 'in', ids)
    .execute();
  return rows.map((row) => ({ provider: row.provider, payload: payloadFromRow(row) }));
}

export async function upsertProviderSetting(setting) {
  const id = cleanText(setting?.provider);
  if (!id) throw new Error('PROVIDER_REQUIRED');
  await getKyselyDb()
    .insertInto('provider_settings')
    .values({
      provider: id,
      position: 0,
      enabled: setting.enabled !== false,
      payload: sql`${JSON.stringify(setting)}::jsonb`,
      updated_at: setting.updatedAt || new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column('provider').doUpdateSet({
        enabled: sql`excluded.enabled`,
        payload: sql`excluded.payload`,
        updated_at: sql`excluded.updated_at`,
      }),
    )
    .execute();
  return setting;
}

