export function runRowClass(run, { includeStale = true } = {}) {
  if (String(run?.status) === 'failed') return 'failedRow';
  if (run?.stuck) return 'stuckRow';
  if (String(run?.status) === 'running') return 'runningRow';
  return includeStale && run?.stale ? 'staleRow' : '';
}

export function mobileRunClass(run, { includeStale = true } = {}) {
  if (String(run?.status) === 'failed') return 'mobileRunCard--failed';
  if (run?.stuck) return 'mobileRunCard--stuck';
  if (String(run?.status) === 'running') return 'mobileRunCard--running';
  return includeStale && run?.stale ? 'mobileRunCard--stale' : '';
}

export function runStatusPillFor({ run, runStatusPill, textFor, esc, includeStale = true }) {
  if (run?.stuck) return `<span class="pill pillStatus pillStatus--fail">${esc(textFor('jobRunStuck'))}</span>`;
  return runStatusPill(run?.status, includeStale && !!run?.stale);
}

export function runProgressText({ run, formatDuration, textFor }) {
  if (String(run?.status) !== 'running') return '-';
  const parts = [];
  if (Number.isFinite(Number(run.progressPercent))) parts.push(`${Number(run.progressPercent)}%`);
  if (run.progressPhase) parts.push(String(run.progressPhase));
  if (Number.isFinite(Number(run.progressDone)) && Number.isFinite(Number(run.progressTotal)) && Number(run.progressTotal) > 0) {
    parts.push(`${Number(run.progressDone)}/${Number(run.progressTotal)}`);
  }
  if (Number.isFinite(Number(run.elapsedMs))) parts.push(`${textFor('jobRunElapsed')} ${formatDuration(run.elapsedMs)}`);
  if (Number.isFinite(Number(run.quietMs))) parts.push(`${textFor('jobRunQuiet')} ${formatDuration(run.quietMs)}`);
  return parts.join(' · ') || '-';
}
