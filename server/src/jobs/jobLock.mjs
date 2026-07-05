import { config } from '../config.mjs';

function validTime(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function runTiming(run, job = null) {
  const now = Date.now();
  const startedMs = validTime(run?.startedAt);
  const finishedMs = validTime(run?.finishedAt);
  const lastSignalMs = validTime(run?.progressUpdatedAt) || finishedMs || startedMs;
  const elapsedMs =
    run?.status === 'running' && startedMs != null
      ? now - startedMs
      : Number.isFinite(Number(run?.durationMs))
        ? Number(run.durationMs)
        : finishedMs != null && startedMs != null
          ? finishedMs - startedMs
          : null;
  const quietMs = run?.status === 'running' && lastSignalMs != null ? now - lastSignalMs : null;
  const intervalMs = Math.max(0, Number(job?.intervalSeconds || run?.intervalSeconds || 0) * 1000);
  const stuckThresholdMs = Math.max(5 * 60 * 1000, intervalMs > 0 ? intervalMs * 1.5 : 0);
  const stuck =
    run?.status === 'running' &&
    ((elapsedMs != null && elapsedMs > stuckThresholdMs) || (quietMs != null && quietMs > 5 * 60 * 1000));
  return { elapsedMs, quietMs, stuck, lastSignalAt: lastSignalMs == null ? null : new Date(lastSignalMs).toISOString() };
}

export function jobLockStaleThresholdMs(job) {
  const ttlMs = Math.max(60_000, Number(config.jobLockTtlMs || 0));
  const staleSeconds = Number(job?.staleLockSeconds);
  if (Number.isFinite(staleSeconds) && staleSeconds > 0) return Math.max(60_000, staleSeconds * 1000);
  const lockSeconds = Number(job?.lockTtlSeconds);
  if (Number.isFinite(lockSeconds) && lockSeconds > 0) return Math.max(60_000, lockSeconds * 1000);
  return ttlMs;
}

export function resolveActiveRunningRun(latestRun, recentRuns = []) {
  if (latestRun?.status === 'running') return latestRun;
  return recentRuns.find((run) => run?.status === 'running') || null;
}

export function jobLockState({ job, lock, latestRun, activeRunningRun = null }) {
  if (!lock) {
    return {
      locked: false,
      hasLockRow: false,
      canForceUnlock: false,
      reason: null,
      lockedAt: null,
      expiresAt: null,
      staleAfterMs: null,
      activeRunningRunId: null,
    };
  }
  const runningRun = activeRunningRun || resolveActiveRunningRun(latestRun);
  const timing = runTiming(runningRun, job);
  const staleAfterMs = jobLockStaleThresholdMs(job);
  const expiresMs = validTime(lock.expiresAt);
  const lockedAtMs = validTime(lock.lockedAt);
  const expired = expiresMs != null && expiresMs <= Date.now();
  const running = Boolean(runningRun);
  const elapsedStale = running && Number.isFinite(Number(timing.elapsedMs)) && Number(timing.elapsedMs) >= staleAfterMs;
  const quietStale = running && Number.isFinite(Number(timing.quietMs)) && Number(timing.quietMs) >= staleAfterMs;
  const lockAgeMs = lockedAtMs == null ? null : Date.now() - lockedAtMs;
  const orphanedLock = !running && lockAgeMs != null && lockAgeMs >= staleAfterMs;
  const latestFinishedMs = validTime(latestRun?.finishedAt);
  const runCompletedWhileLocked =
    !running &&
    latestRun &&
    latestRun.status !== 'running' &&
    latestFinishedMs != null &&
    (lockedAtMs == null || latestFinishedMs >= lockedAtMs);
  const canForceUnlock = expired || elapsedStale || quietStale || orphanedLock || runCompletedWhileLocked;
  let reason = 'active';
  if (expired) reason = 'expired';
  else if (runCompletedWhileLocked) reason = 'completed_run';
  else if (quietStale) reason = 'quiet_ttl';
  else if (elapsedStale) reason = 'running_ttl';
  else if (orphanedLock) reason = 'orphaned_lock';
  return {
    locked: !canForceUnlock,
    hasLockRow: true,
    canForceUnlock,
    reason,
    lockedAt: lock.lockedAt || null,
    expiresAt: lock.expiresAt || null,
    staleAfterMs,
    activeRunningRunId: runningRun?.id || null,
  };
}
