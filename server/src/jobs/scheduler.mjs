import { listDuePollingJobs } from '../db.mjs';
import { runPollingJob } from './runner.mjs';

export function findDuePollingJobs(db, now = Date.now()) {
  return db.pollingJobs.filter((job) => {
    if (!job.enabled) return false;
    if (!job.nextRunAt) return true;
    return new Date(job.nextRunAt).getTime() <= now;
  });
}

export function startScheduler({ intervalMs = 10_000 } = {}) {
  const runningJobKeys = new Set();

  const tick = async () => {
    const due = await listDuePollingJobs();
    for (const job of due) {
      if (runningJobKeys.has(job.jobKey)) continue;
      runningJobKeys.add(job.jobKey);
      runPollingJob(job.jobKey, { trigger: 'schedule' })
        .catch((error) => {
          console.error(`[scheduler] ${job.jobKey} failed`, error);
        })
        .finally(() => {
          runningJobKeys.delete(job.jobKey);
        });
    }
  };

  const id = setInterval(() => {
    tick().catch((error) => console.error('[scheduler] tick failed', error));
  }, intervalMs);
  tick().catch((error) => console.error('[scheduler] initial tick failed', error));
  return () => clearInterval(id);
}
