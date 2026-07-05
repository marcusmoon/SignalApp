import { nowIso, patchPollingJobRun, renewPollingJobLock } from '../db.mjs';

/**
 * Job run lock renewal + progress heartbeat (JOB_WORKER_LOST 방지).
 */
export function createJobRunProgress({ jobKey, job, lock, runId, jobLockTtlMs }) {
  const touch = async (patch = {}) => {
    await renewPollingJobLock(jobKey, lock.token, { ttlMs: jobLockTtlMs(job) }).catch((error) => {
      console.warn(`[job:${jobKey}] failed to renew lock`, error?.message || error);
    });
    await patchPollingJobRun(runId, {
      progressUpdatedAt: nowIso(),
      ...patch,
    });
  };

  return { touch };
}

export function createMcapProgressHandler({ jobKey, touch }) {
  let lastProgressAt = 0;
  let lastProgressPercent = -1;

  return async ({ phase, done, total, symbol } = {}) => {
    const safeDone = Math.max(0, Number(done) || 0);
    const safeTotal = Math.max(0, Number(total) || 0);
    const now = Date.now();

    let percent = 0;
    if (phase === 'profiles') percent = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 50) : 0;
    else if (phase === 'quotes') percent = safeTotal > 0 ? 50 + Math.round((safeDone / safeTotal) * 50) : 50;
    else if (phase === 'transcripts') percent = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0;

    const percentDelta = Math.abs(percent - lastProgressPercent);
    const shouldPersist =
      percent !== lastProgressPercent &&
      (now - lastProgressAt > 5000 || percent === 0 || percent === 100 || safeDone === safeTotal || percentDelta >= 10);

    if (!shouldPersist) return;

    lastProgressAt = now;
    lastProgressPercent = percent;
    console.log(
      `[job:${jobKey}] progress ${percent}% (${phase || 'unknown'} ${safeDone}/${safeTotal})${symbol ? ` ${symbol}` : ''}`,
    );
    await touch({
      progressPhase: phase || null,
      progressDone: safeDone,
      progressTotal: safeTotal,
      progressPercent: percent,
    });
  };
}

/** sync Job 중 DB 저장 뉴스를 재보정하는 reconcile Job */
export function jobHasStoredNewsReconcile(job) {
  if (!job?.params?.reconcile) return false;
  const provider = String(job?.provider || '');
  const handler = String(job?.handler || '');
  if (provider === 'finnhub' && handler === 'market_news') return true;
  if (provider === 'rss' && (handler === 'financial_juice' || handler === 'newswire_rss')) return true;
  return false;
}

/** reconcile 단계에서 DB 스냅샷을 다시 읽어야 하는 Job */
export function jobNeedsFreshContext(job, phase) {
  if (phase !== 'reconcile') return false;
  const provider = String(job?.provider || '');
  if (provider === 'youtube') return true;
  return jobHasStoredNewsReconcile(job);
}

/** sync Job 중 API reconcile(캘린더 등)을 제외하고 DB 재보정이 필요한지 */
export function jobUsesStoredNewsReconcile(job, phase) {
  return phase === 'reconcile' && jobHasStoredNewsReconcile(job);
}

const MCAP_PROGRESS_HANDLERS = new Set(['market_quotes_mcap', 'market_quotes_mcap_universe']);

export function jobUsesMcapProgress(handler) {
  return MCAP_PROGRESS_HANDLERS.has(String(handler || ''));
}
