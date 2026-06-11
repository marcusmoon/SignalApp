import { getKyselyDb, sql } from '../kysely/client.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function safeLimit(value, fallback = 200, max = 500) {
  return Math.min(max, Math.max(1, Math.floor(Number(value)) || fallback));
}

function payloadFromRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return payload && typeof payload === 'object' ? payload : null;
}

export async function findPollingJob(jobKey) {
  const key = cleanText(jobKey);
  if (!key) return null;
  const row = await getKyselyDb()
    .selectFrom('polling_jobs')
    .select('payload')
    .where('job_key', '=', key)
    .executeTakeFirst();
  return payloadFromRow(row);
}

export async function findPollingJobs() {
  const rows = await getKyselyDb()
    .selectFrom('polling_jobs')
    .select('payload')
    .orderBy('position', 'asc')
    .orderBy('job_key', 'asc')
    .execute();
  return rows.map(payloadFromRow).filter(Boolean);
}

export async function findPollingJobRuns({ limit = 200, jobKey = '' } = {}) {
  const key = cleanText(jobKey);
  let query = getKyselyDb().selectFrom('polling_job_runs').select('payload');
  if (key) query = query.where('job_key', '=', key);
  const rows = await query
    .orderBy(sql`started_at desc nulls last`)
    .orderBy('position', 'asc')
    .limit(safeLimit(limit, 200, 500))
    .execute();
  return rows.map(payloadFromRow).filter(Boolean);
}

