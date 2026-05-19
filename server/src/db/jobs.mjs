import crypto from 'node:crypto';

function parsePayload(label, payload, fallback = null) {
  if (payload == null || payload === '') return fallback;
  try {
    return JSON.parse(payload);
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    wrapped.message = `${wrapped.message} (${label})`;
    throw wrapped;
  }
}

function jobFromRow(row) {
  if (!row) return null;
  return parsePayload(`polling_jobs.${row.job_key}`, row.payload, null);
}

export function listDuePollingJobsInDb(db, now = new Date()) {
  const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  return db
    .prepare(
      `
        SELECT job_key, payload
        FROM polling_jobs
        WHERE enabled = 1
          AND (next_run_at IS NULL OR next_run_at = '' OR next_run_at <= ?)
        ORDER BY position ASC
      `,
    )
    .all(nowIso)
    .map(jobFromRow)
    .filter(Boolean);
}

export function getPollingJobInDb(db, jobKey) {
  const key = String(jobKey || '').trim();
  if (!key) return null;
  const row = db.prepare('SELECT job_key, payload FROM polling_jobs WHERE job_key = ?').get(key);
  return jobFromRow(row);
}

export function getPollingJobLockInDb(db, jobKey) {
  const key = String(jobKey || '').trim();
  if (!key) return null;
  const row = db
    .prepare(
      `
        SELECT job_key, lock_token, locked_at, expires_at
        FROM polling_job_locks
        WHERE job_key = ?
      `,
    )
    .get(key);
  if (!row) return null;
  return {
    jobKey: row.job_key,
    lockToken: row.lock_token,
    lockedAt: row.locked_at,
    expiresAt: row.expires_at,
  };
}

export function listPollingJobLocksInDb(db) {
  return db
    .prepare(
      `
        SELECT job_key, lock_token, locked_at, expires_at
        FROM polling_job_locks
        ORDER BY locked_at DESC
      `,
    )
    .all()
    .map((row) => ({
      jobKey: row.job_key,
      lockToken: row.lock_token,
      lockedAt: row.locked_at,
      expiresAt: row.expires_at,
    }));
}

export function acquirePollingJobLockInDb(db, jobKey, { ttlMs = 2 * 60 * 60 * 1000 } = {}) {
  const key = String(jobKey || '').trim();
  if (!key) return null;
  const token = crypto.randomUUID();
  const now = new Date();
  const lockedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + Math.max(60_000, Number(ttlMs) || 0)).toISOString();

  db.prepare('DELETE FROM polling_job_locks WHERE expires_at <= ?').run(lockedAt);
  const result = db
    .prepare(
      `
        INSERT INTO polling_job_locks (job_key, lock_token, locked_at, expires_at)
        VALUES (@jobKey, @token, @lockedAt, @expiresAt)
        ON CONFLICT(job_key) DO UPDATE SET
          lock_token = excluded.lock_token,
          locked_at = excluded.locked_at,
          expires_at = excluded.expires_at
        WHERE polling_job_locks.expires_at <= @lockedAt
      `,
    )
    .run({ jobKey: key, token, lockedAt, expiresAt });

  return Number(result?.changes || 0) > 0 ? { jobKey: key, token, lockedAt, expiresAt } : null;
}

export function releasePollingJobLockInDb(db, jobKey, token) {
  const key = String(jobKey || '').trim();
  const lockToken = String(token || '').trim();
  if (!key || !lockToken) return false;
  const result = db
    .prepare('DELETE FROM polling_job_locks WHERE job_key = ? AND lock_token = ?')
    .run(key, lockToken);
  return Number(result?.changes || 0) > 0;
}
