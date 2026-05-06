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
