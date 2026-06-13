import { queryKysely, withKyselyTransaction } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import { cleanText } from './publicHelpers.mjs';

export async function listLegalTermRows(options = {}) {
  const locale = cleanText(options.locale);
  const type = cleanText(options.type);
  const params = [];
  const where = [];
  if (locale) {
    params.push(locale);
    where.push(`locale = $${params.length}`);
  }
  if (type) {
    params.push(type);
    where.push(`type = $${params.length}`);
  }
  if (options.activeOnly) where.push('active = true');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const latest = options.latestOnly
    ? `
        SELECT *
        FROM (
          SELECT t.*, ROW_NUMBER() OVER (PARTITION BY type, locale ORDER BY updated_at DESC, version DESC) AS rn
          FROM legal_terms t
          ${whereSql}
        ) x
        WHERE rn = 1
      `
    : `SELECT * FROM legal_terms ${whereSql}`;
  const result = await queryKysely(
    `
      ${latest}
      ORDER BY locale ASC, CASE type WHEN 'service' THEN 1 WHEN 'privacy' THEN 2 ELSE 9 END ASC, updated_at DESC
    `,
    params,
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    locale: row.locale,
    version: row.version,
    title: row.title,
    body: row.body,
    required: row.required === true,
    active: row.active === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }));
}

export async function updateLegalTermRow(type, locale, patch = {}) {
  const nextType = cleanText(type).toLowerCase() || 'service';
  const nextLocale = cleanText(locale).toLowerCase() || 'ko';
  const version = cleanText(patch.version) || nowIso().slice(0, 10).replaceAll('-', '.');
  const now = nowIso();
  const title = cleanText(patch.title) || nextType;
  const body = cleanText(patch.body);
  if (!body) throw new Error('LEGAL_TERM_BODY_REQUIRED');
  return withKyselyTransaction(async (client) => {
    if (patch.active !== false) {
      await client.query('UPDATE legal_terms SET active = false, updated_at = $1 WHERE type = $2 AND locale = $3 AND version <> $4', [
        now,
        nextType,
        nextLocale,
        version,
      ]);
    }
    await client.query(
      `
        INSERT INTO legal_terms (id, type, locale, version, title, body, required, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        ON CONFLICT(type, locale, version) DO UPDATE SET
          title = excluded.title,
          body = excluded.body,
          required = excluded.required,
          active = excluded.active,
          updated_at = excluded.updated_at
      `,
      [
        `${nextType}:${nextLocale}:${version}`,
        nextType,
        nextLocale,
        version,
        title,
        body,
        patch.required !== false,
        patch.active !== false,
        now,
      ],
    );
    return (await listLegalTermRows({ type: nextType, locale: nextLocale, latestOnly: false })).find((term) => term.version === version) || null;
  });
}

export async function listAppUserTermAcceptanceRows(userId) {
  const result = await queryKysely(
    `
      SELECT *
      FROM app_user_terms_acceptances
      WHERE user_id = $1
      ORDER BY accepted_at DESC
    `,
    [cleanText(userId)],
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.term_type,
    locale: row.locale,
    version: row.version,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
  }));
}
