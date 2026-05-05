import { renderIngestWorkflowNav } from './ingestNav.js';
import { mobileRunClass, runProgressText, runRowClass, runStatusPillFor } from './runVisuals.js';

export async function loadMonitoringView(ctx) {
  const {
    api,
    $,
    state,
    esc,
    textFor,
    formatDateTime,
    formatDuration,
    operationBadge,
    providerBadge,
    domainBadge,
    runStatusPill,
    runButton,
  } = ctx;

  if (!$('monitoring')) return;
  const summary = (await api('/admin/api/summary')).data;
  const runsAll = summary.recentRuns || [];
  const opRuns = state.operationFilter === 'all' ? runsAll : runsAll.filter((r) => (r.operation || 'latest') === state.operationFilter);
  const runs = [...opRuns].sort((a, b) => {
    if (state.monitoringSort === 'name') {
      const an = String(a.displayName || a.jobKey || '').toLowerCase();
      const bn = String(b.displayName || b.jobKey || '').toLowerCase();
      return an.localeCompare(bn);
    }
    const at = new Date(a.finishedAt || a.startedAt || 0).getTime();
    const bt = new Date(b.finishedAt || b.startedAt || 0).getTime();
    return state.monitoringSort === 'oldest' ? at - bt : bt - at;
  });
  const stale = runs.filter((r) => r.stale);
  const running = runs.filter((r) => String(r.status) === 'running');
  const stuck = runs.filter((r) => r.stuck);
  $('monitoring').innerHTML = `
    ${renderIngestWorkflowNav({ activeView: 'monitoring', esc, textFor })}
    <div class="statGrid wideStats">
      <div class="stat"><div class="statLabel muted"><span class="statIcon">R</span>${esc(textFor('statRecentRuns'))}</div><div class="statNum">${runs.length}</div></div>
      <div class="stat"><div class="statLabel muted"><span class="statIcon">P</span>${esc(textFor('statRunningRuns'))}</div><div class="statNum">${running.length}</div></div>
      <div class="stat"><div class="statLabel muted"><span class="statIcon">!</span>${esc(textFor('statStuckRuns'))}</div><div class="statNum">${stuck.length}</div></div>
      <div class="stat"><div class="statLabel muted"><span class="statIcon">S</span>${esc(textFor('statStale'))}</div><div class="statNum">${stale.length}</div></div>
      <div class="stat"><div class="statLabel muted"><span class="statIcon">J</span>${esc(textFor('statActiveJobs'))}</div><div class="statNum">${summary.counts.enabledJobs}</div></div>
      <div class="stat"><div class="statLabel muted"><span class="statIcon">!</span>${esc(textFor('statRecentFailures'))}</div><div class="statNum">${summary.counts.recentFailedRuns}</div></div>
    </div>
    <div class="card card--elevated" style="margin-top:12px">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('pageMonitoringTitle'))}</div>
          <div class="cardHint">${esc(textFor('sectionRecentRuns'))}</div>
        </div>
        <div class="cardHeadActions">
          <div class="tabs" style="margin:0">
            <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">${esc(textFor('tabAll'))}</button>
            <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">${esc(textFor('tabLatest'))}</button>
            <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">${esc(textFor('tabReconcile'))}</button>
          </div>
          <select id="monitoringSort" style="min-width:140px">
            <option value="newest" ${state.monitoringSort === 'newest' ? 'selected' : ''}>${esc(textFor('sortNewest'))}</option>
            <option value="oldest" ${state.monitoringSort === 'oldest' ? 'selected' : ''}>${esc(textFor('sortOldest'))}</option>
            <option value="name" ${state.monitoringSort === 'name' ? 'selected' : ''}>${esc(textFor('sortName'))}</option>
          </select>
          <button class="secondary" id="refreshMonitoringBtn">${esc(textFor('btnRefresh'))}</button>
        </div>
      </div>
      <table class="settingsTable monitoringDesktopTable">
        <thead>
          <tr>
            <th>${esc(textFor('colJob'))}</th>
            <th>${esc(textFor('colStatus'))}</th>
            <th>${esc(textFor('colOperation'))}</th>
            <th>${esc(textFor('colDomain'))}</th>
            <th>${esc(textFor('colProvider'))}</th>
            <th>${esc(textFor('colProgress'))}</th>
            <th class="right">${esc(textFor('colItems'))}</th>
            <th>${esc(textFor('colFinished'))}</th>
            <th class="center">${esc(textFor('colAction'))}</th>
          </tr>
        </thead>
        <tbody>
          ${
            runs.length === 0
              ? `<tr><td colspan="9" class="muted">${esc(textFor('monitoringEmpty'))}</td></tr>`
              : runs
                  .map(
                    (run) => `
              <tr class="${runRowClass(run)}">
                <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                <td>${runStatusPillFor({ run, runStatusPill, textFor, esc })}</td>
                <td>${operationBadge(run.operation)}</td>
                <td>${domainBadge(run.domain || run.resultKind)}</td>
                <td>${providerBadge(run.provider)}</td>
                <td class="muted">${esc(runProgressText({ run, formatDuration, textFor }))}</td>
                <td class="right">${run.itemCount ?? 0}</td>
                <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
                <td class="center">
                  <div class="dataTableActions">
                    ${runButton(run.jobKey, textFor('btnNowRun'))}
                    <button class="secondary" data-open-job-log="${esc(run.jobKey)}">${esc(textFor('btnLogErrors'))}</button>
                  </div>
                </td>
              </tr>
            `,
                  )
                  .join('')
          }
        </tbody>
      </table>
      <div class="mobileRunList monitoringMobileList">
        ${
          runs.length === 0
            ? `<p class="muted">${esc(textFor('monitoringEmpty'))}</p>`
            : runs
                .map(
                  (run) => `
                    <article class="mobileRunCard ${mobileRunClass(run)}">
                      <div class="mobileRunCardHead">
                        <div class="mobileJobTitle">
                          <strong>${esc(run.displayName || run.jobKey)}</strong>
                          <span class="muted">${esc(run.jobKey)}</span>
                        </div>
                        ${runStatusPillFor({ run, runStatusPill, textFor, esc })}
                      </div>
                      <div class="mobileJobMeta">
                        ${operationBadge(run.operation)}
                        ${domainBadge(run.domain || run.resultKind)}
                        ${providerBadge(run.provider)}
                      </div>
                      <div class="mobileRunStats">
                        <span>${esc(textFor('colItems'))} <strong>${run.itemCount ?? 0}</strong></span>
                        <span>${esc(textFor('colProgress'))} <strong>${esc(runProgressText({ run, formatDuration, textFor }))}</strong></span>
                        <span>${esc(textFor('colFinished'))} <strong>${esc(formatDateTime(run.finishedAt || run.startedAt))}</strong></span>
                      </div>
                      <div class="mobileJobFoot">
                        <span class="muted">${run.stale ? esc(textFor('statStale')) : ''}</span>
                        <div class="dataTableActions">
                          ${runButton(run.jobKey, textFor('btnNowRun'))}
                          <button class="secondary compactBtn" data-open-job-log="${esc(run.jobKey)}">${esc(textFor('btnLogErrors'))}</button>
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join('')
        }
      </div>
      <div class="cardFoot">
        <div class="muted">${esc(textFor('tipSlowJobs'))}</div>
      </div>
    </div>
  `;
}

export async function loadErrorsView(ctx) {
  const {
    api,
    $,
    state,
    esc,
    textFor,
    formatDateTime,
    formatDuration,
    operationBadge,
    providerBadge,
    domainBadge,
    runStatusPill,
    runErrorButton,
    runButton,
  } = ctx;

  if (!$('errors')) return;
  const body = await api(`/admin/api/job-runs?${new URLSearchParams({ status: 'failed', pageSize: '30', page: '1' }).toString()}`);
  const all = Array.isArray(body.data) ? body.data : [];
  const filtered = state.operationFilter === 'all' ? all : all.filter((r) => (r.operation || 'latest') === state.operationFilter);
  state.errorRows = filtered;
  $('errors').innerHTML =
    `
      ${renderIngestWorkflowNav({ activeView: 'errors', esc, textFor })}
      <div class="tabs" style="margin-bottom:10px">
        <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">${esc(textFor('tabAll'))}</button>
        <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">${esc(textFor('tabLatest'))}</button>
        <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">${esc(textFor('tabReconcile'))}</button>
      </div>
    ` +
    (filtered.length === 0
      ? `<p class="muted">${esc(textFor('errorsEmpty'))}</p>`
      : `
          <table class="errorsDesktopTable">
            <thead>
              <tr>
                <th>${esc(textFor('colJob'))}</th>
                <th>${esc(textFor('colStatus'))}</th>
                <th>${esc(textFor('colRunInfo'))}</th>
                <th>${esc(textFor('colTiming'))}</th>
                <th class="center">${esc(textFor('colAction'))}</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(
                  (run) => `
                <tr class="${String(run.status) === 'failed' ? 'failedRow' : ''}">
                  <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                  <td>${runStatusPill(run.status, false)}</td>
                  <td>
                    <div class="runMetaStack">
                      ${operationBadge(run.operation)}
                      ${domainBadge(run.domain || run.resultKind)}
                      ${providerBadge(run.provider)}
                      <span class="pill">${esc(run.trigger || '-')}</span>
                    </div>
                  </td>
                  <td>
                    <strong>${esc(formatDuration(run.durationMs))}</strong><br/>
                    <span class="muted">${esc(formatDateTime(run.startedAt))}</span>
                  </td>
                  <td class="center">
                    <div class="dataTableActions">
                      ${runErrorButton(run)}
                      ${runButton(run.jobKey, textFor('btnRetry'))}
                    </div>
                  </td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
          <div class="mobileRunList errorsMobileList">
            ${filtered
              .map(
                (run) => `
                  <article class="mobileRunCard mobileRunCard--failed">
                    <div class="mobileRunCardHead">
                      <div class="mobileJobTitle">
                        <strong>${esc(run.displayName || run.jobKey)}</strong>
                        <span class="muted">${esc(run.jobKey)}</span>
                      </div>
                      ${runStatusPill(run.status, false)}
                    </div>
                    <div class="mobileJobMeta">
                      ${operationBadge(run.operation)}
                      ${domainBadge(run.domain || run.resultKind)}
                      ${providerBadge(run.provider)}
                      <span class="pill">${esc(run.trigger || '-')}</span>
                    </div>
                    <div class="mobileRunStats">
                      <span>${esc(textFor('colDuration'))} <strong>${esc(formatDuration(run.durationMs))}</strong></span>
                      <span>${esc(textFor('colTiming'))} <strong>${esc(formatDateTime(run.startedAt))}</strong></span>
                    </div>
                    <div class="mobileJobFoot">
                      <span class="muted"></span>
                      <div class="dataTableActions">
                        ${runErrorButton(run)}
                        ${runButton(run.jobKey, textFor('btnRetry'))}
                      </div>
                    </div>
                  </article>
                `,
              )
              .join('')}
          </div>
        `);
}
