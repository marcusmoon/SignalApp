import { getKyselyDb } from '../kysely/client.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function publicJobLock(row) {
  if (!row) return null;
  return {
    jobKey: row.job_key,
    token: row.lock_token,
    lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

export async function findPollingJobLocks() {
  const rows = await getKyselyDb()
    .selectFrom('polling_job_locks')
    .selectAll()
    .orderBy('locked_at', 'desc')
    .execute();
  return rows.map(publicJobLock);
}

export async function findPollingJobLock(jobKey) {
  const key = cleanText(jobKey);
  if (!key) return null;
  const row = await getKyselyDb()
    .selectFrom('polling_job_locks')
    .selectAll()
    .where('job_key', '=', key)
    .executeTakeFirst();
  return publicJobLock(row);
}

export async function acquirePollingJobLockRow(jobKey, { token, lockedAt, expiresAt }) {
  const key = cleanText(jobKey);
  if (!key) throw new Error('JOB_KEY_REQUIRED');
  return getKyselyDb().transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('polling_job_locks')
      .selectAll()
      .where('job_key', '=', key)
      .forUpdate()
      .executeTakeFirst();
    if (current && new Date(current.expires_at).getTime() > Date.now()) {
      return { acquired: false, lock: publicJobLock(current) };
    }
    await trx
      .insertInto('polling_job_locks')
      .values({
        job_key: key,
        lock_token: token,
        locked_at: lockedAt,
        expires_at: expiresAt,
      })
      .onConflict((oc) =>
        oc.column('job_key').doUpdateSet({
          lock_token: (eb) => eb.ref('excluded.lock_token'),
          locked_at: (eb) => eb.ref('excluded.locked_at'),
          expires_at: (eb) => eb.ref('excluded.expires_at'),
        }),
      )
      .execute();
    return { acquired: true, lock: { jobKey: key, token, lockedAt, expiresAt } };
  });
}

export async function deletePollingJobLock(jobKey, token) {
  const result = await getKyselyDb()
    .deleteFrom('polling_job_locks')
    .where('job_key', '=', cleanText(jobKey))
    .where('lock_token', '=', cleanText(token))
    .executeTakeFirst();
  return Number(result?.numDeletedRows || 0) > 0;
}

