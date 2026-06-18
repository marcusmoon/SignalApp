export function runModeForJob(job, mode = 'full') {
  const text = String(mode || 'full').trim().toLowerCase();
  if (text === 'latest' || text === 'reconcile' || text === 'full') return text;
  return 'full';
}

export function primaryParams(job) {
  const params = { ...(job?.params || {}) };
  delete params.reconcile;
  return params;
}

export function reconcilePhaseParams(job) {
  const rec = job?.params?.reconcile;
  if (!rec || typeof rec !== 'object') return null;
  return { ...primaryParams(job), ...rec };
}

export function paramsForPhase(job, phase) {
  if (phase === 'reconcile') return reconcilePhaseParams(job) || primaryParams(job);
  return primaryParams(job);
}

export function phasesForJob(job, mode = 'full') {
  const resolved = runModeForJob(job, mode);
  const op = String(job?.operation || 'latest').toLowerCase();

  if (op === 'reconcile') {
    return resolved === 'latest' ? [] : ['reconcile'];
  }

  if (resolved === 'reconcile') {
    if (op === 'sync' && job?.params?.reconcile) return ['reconcile'];
    return [];
  }

  if (resolved === 'latest') return ['latest'];

  const phases = ['latest'];
  if (op === 'sync' && job?.params?.reconcile) phases.push('reconcile');
  return phases;
}
