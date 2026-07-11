import {
  forceReleasePollingJobLock,
  getPollingJob,
  getPollingJobLock,
  listPollingJobRuns,
  listPollingJobs,
  listPollingJobLocks,
  nowIso,
  patchPollingJobRun,
  purgeExpiredPollingJobLocks,
} from '../db.mjs';
import { jobLockState, resolveActiveRunningRun } from './jobLock.mjs';

const ORPHAN_RUN_ERROR = 'JOB_WORKER_LOST';

function startedMs(run) {
  const ms = new Date(run?.startedAt || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : Date.now();
}

export async function failOrphanedPollingJobRun(run, errorMessage = ORPHAN_RUN_ERROR) {
  if (!run?.id || run.status !== 'running') return false;
  const finishedAt = nowIso();
  await patchPollingJobRun(run.id, {
    status: 'failed',
    finishedAt,
    durationMs: Date.now() - startedMs(run),
    errorMessage,
    progressUpdatedAt: finishedAt,
  });
  return true;
}

async function reconcileLockedJob({ job, lock, runs }) {
  const latestRun = runs[0] || null;
  const activeRunningRun = resolveActiveRunningRun(latestRun, runs);
  const state = jobLockState({ job, lock, latestRun, activeRunningRun });
  if (!state.canForceUnlock) return { released: false, failedRuns: 0 };

  let failedRuns = 0;
  if (activeRunningRun) {
    failedRuns += (await failOrphanedPollingJobRun(activeRunningRun)) ? 1 : 0;
  }
  const released = await forceReleasePollingJobLock(lock.jobKey);
  return { released, failedRuns, reason: state.reason };
}

export async function reconcileJobLocksAndRuns() {
  const jobs = await listPollingJobs();
  const jobByKey = new Map(jobs.map((job) => [job.jobKey, job]));
  const expiredLocks = await purgeExpiredPollingJobLocks();
  const locks = await listPollingJobLocks();

  let releasedLocks = 0;
  let failedRuns = 0;

  for (const lock of locks) {
    const job = jobByKey.get(lock.jobKey) || (await getPollingJob(lock.jobKey));
    const runs = await listPollingJobRuns({ jobKey: lock.jobKey, limit: 20 });
    const result = await reconcileLockedJob({ job, lock, runs });
    if (result.released) releasedLocks += 1;
    failedRuns += result.failedRuns || 0;
  }

  const recentRuns = await listPollingJobRuns({ limit: 500 });
  for (const run of recentRuns) {
    if (run.status !== 'running') continue;
    const lock = await getPollingJobLock(run.jobKey);
    const expiresMs = lock?.expiresAt ? new Date(lock.expiresAt).getTime() : null;
    const lockValid = lock && Number.isFinite(expiresMs) && expiresMs > Date.now();
    if (lockValid) continue;
    failedRuns += (await failOrphanedPollingJobRun(run)) ? 1 : 0;
  }

  return { expiredLocks, releasedLocks, failedRuns };
}

export async function forceReleaseStaleJobLock(jobKey) {
  const job = await getPollingJob(jobKey);
  if (!job) throw new Error(`JOB_NOT_FOUND:${jobKey}`);
  const lock = await getPollingJobLock(jobKey);
  if (!lock) throw new Error('JOB_LOCK_NOT_FOUND');

  const runs = await listPollingJobRuns({ jobKey, limit: 20 });
  const latestRun = runs[0] || null;
  const activeRunningRun = resolveActiveRunningRun(latestRun, runs);
  const state = jobLockState({ job, lock, latestRun, activeRunningRun });
  if (!state.canForceUnlock) {
    const error = new Error('JOB_LOCK_NOT_STALE');
    error.state = state;
    throw error;
  }

  let failedRuns = 0;
  if (activeRunningRun) {
    failedRuns += (await failOrphanedPollingJobRun(activeRunningRun)) ? 1 : 0;
  }
  const released = await forceReleasePollingJobLock(jobKey);
  return { released, failedRuns, state };
}

let maintenanceInFlight = null;

export function startJobLockMaintenance({ intervalMs = 60_000 } = {}) {
  const runOnce = () => {
    if (maintenanceInFlight) return maintenanceInFlight;
    maintenanceInFlight = reconcileJobLocksAndRuns()
      .then((summary) => {
        if (summary.expiredLocks > 0 || summary.releasedLocks > 0 || summary.failedRuns > 0) {
          console.log(
            `[job-lock] reconciled expiredLocks=${summary.expiredLocks} releasedLocks=${summary.releasedLocks} failedRuns=${summary.failedRuns}`,
          );
        }
        return summary;
      })
      .catch((error) => {
        console.error('[job-lock] reconcile failed', error);
        throw error;
      })
      .finally(() => {
        maintenanceInFlight = null;
      });
    return maintenanceInFlight;
  };

  runOnce().catch(() => {});
  const id = setInterval(() => {
    runOnce().catch(() => {});
  }, Math.max(15_000, Number(intervalMs) || 60_000));

  return () => clearInterval(id);
}
