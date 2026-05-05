import { timeBasis } from '../format.js';

export function createJobRunsSort({ state }) {
  function compareMaybeNumber(a, b) {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(a ?? '').localeCompare(String(b ?? ''));
  }

  function sortJobRuns(rows) {
    const dir = state.jobRunsSortDir === 'asc' ? 1 : -1;
    const key = state.jobRunsSortKey || 'finishedAt';
    return [...(rows || [])].sort((a, b) => {
      if (key === 'job')
        return dir * String(a.displayName || a.jobKey || '').localeCompare(String(b.displayName || b.jobKey || ''));
      if (key === 'status') return dir * String(a.status || '').localeCompare(String(b.status || ''));
      if (key === 'items') return dir * compareMaybeNumber(a.itemCount ?? 0, b.itemCount ?? 0);
      if (key === 'duration') return dir * compareMaybeNumber(a.durationMs ?? 0, b.durationMs ?? 0);
      if (key === 'progress') return dir * compareMaybeNumber(a.progressPercent ?? 0, b.progressPercent ?? 0);
      if (key === 'startedAt') return dir * (new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime());
      if (key === 'finishedAt')
        return dir * (new Date(a.finishedAt || a.startedAt || 0).getTime() - new Date(b.finishedAt || b.startedAt || 0).getTime());
      return 0;
    });
  }

  return { sortJobRuns };
}

function jobRunsQueryParams({ state, $ }) {
  const params = new URLSearchParams({
    page: String(state.jobRunsPage),
    pageSize: $('jobRunPageSize').value,
  });
  for (const [key, id] of [
    ['q', 'jobRunQuery'],
    ['from', 'jobRunFrom'],
    ['to', 'jobRunTo'],
    ['status', 'jobRunStatus'],
    ['type', 'jobRunType'],
    ['jobKey', 'jobRunJob'],
    ['trigger', 'jobRunTrigger'],
  ]) {
    const value = $(id).value.trim();
    if (value) params.set(key, value);
  }
  if (params.has('from') || params.has('to')) params.set('timeZone', timeBasis().timeZone);
  return params.toString();
}

function renderJobRunsPager({ targetId, state, $, esc, textForVars, textFor }) {
  $(targetId).innerHTML = `
    <div class="muted">${esc(textForVars('pagerSummary', { total: state.jobRunsTotal, page: state.jobRunsPage, pages: state.jobRunsTotalPages }))}</div>
    <div class="row">
      <button class="secondary" data-job-runs-page="prev">${esc(textFor('btnPrevious'))}</button>
      <button class="secondary" data-job-runs-page="next">${esc(textFor('btnNext'))}</button>
    </div>
  `;
}

function renderJobEditPanel({ job, esc, textFor, jobDisplayName }) {
  return `
    <div class="jobEditPanel" data-job-edit-scope="${esc(job.jobKey)}">
      <div class="row jobEditPanelHead">
        <strong>${esc(textFor('jobEditPanelTitle'))}</strong>
        <button class="secondary compactBtn" data-job-edit-close="${esc(job.jobKey)}">${esc(textFor('btnClose'))}</button>
      </div>
      <div class="jobSettingsBody" style="margin-top:10px">
        <label>${esc(textFor('jobLabelName'))} <input data-job-name="${esc(job.jobKey)}" value="${esc(jobDisplayName(job))}" placeholder="${esc(textFor('jobLabelNamePh'))}" /></label>
        <label>${esc(textFor('jobLabelDesc'))} <input data-job-desc="${esc(job.jobKey)}" value="${esc(job.description || '')}" placeholder="${esc(textFor('jobLabelDescPh'))}" /></label>
        <label>${esc(textFor('jobLabelIntervalSec'))} <input data-job-interval="${esc(job.jobKey)}" value="${esc(job.intervalSeconds)}" /></label>
        <label>${esc(textFor('jobLabelEnabled'))} <span><input type="checkbox" data-job-enabled="${esc(job.jobKey)}" ${job.enabled ? 'checked' : ''}/> ${esc(textFor('jobEnabledFlag'))}</span></label>
        <label>Provider <input class="readonlyInput" value="${esc(job.provider)}" disabled /></label>
        <label>Handler <input class="readonlyInput" value="${esc(job.handler)}" disabled /></label>
        <label>Operation <input class="readonlyInput" value="${esc(job.operation || 'latest')}" disabled /></label>
        <button data-job-save="${esc(job.jobKey)}" class="success">${esc(textFor('btnSave'))}</button>
      </div>
    </div>
  `;
}

function jobRunRowClass(run) {
  if (String(run.status) === 'failed') return 'failedRow';
  if (run.stuck) return 'stuckRow';
  if (String(run.status) === 'running') return 'runningRow';
  return '';
}

function mobileJobRunClass(run) {
  if (String(run.status) === 'failed') return 'mobileRunCard--failed';
  if (run.stuck) return 'mobileRunCard--stuck';
  if (String(run.status) === 'running') return 'mobileRunCard--running';
  return '';
}

function jobRunStatus({ run, runStatusPill, textFor, esc }) {
  if (run.stuck) return `<span class="pill pillStatus pillStatus--fail">${esc(textFor('jobRunStuck'))}</span>`;
  return runStatusPill(run.status, false);
}

function jobRunProgressText({ run, formatDuration, textFor }) {
  if (String(run.status) !== 'running') return '-';
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

export async function loadJobsView(ctx) {
  const {
    api,
    $,
    state,
    esc,
    textFor,
    jobDisplayName,
    jobGroupTitle,
    operationBadge,
    domainBadge,
    providerBadge,
    jobIntervalLabel,
    formatDateTime,
  } = ctx;

  const body = await api('/admin/api/jobs');
  state.jobs = body.data;
  if ($('jobRunJob')) {
    const current = $('jobRunJob').value;
    $('jobRunJob').innerHTML =
      `<option value="">${esc(textFor('jobListAllJobsOption'))}</option>` +
      body.data
        .map(
          (job) => `
        <option value="${esc(job.jobKey)}">${esc(jobDisplayName(job))}</option>
      `,
        )
        .join('');
    $('jobRunJob').value = current;
  }
  const jobsAll = body.data;
  let jobsFiltered =
    state.operationFilter === 'all' ? jobsAll : jobsAll.filter((j) => (j.operation || 'latest') === state.operationFilter);

  if (state.jobListEnabled === 'enabled') jobsFiltered = jobsFiltered.filter((j) => !!j.enabled);
  if (state.jobListEnabled === 'disabled') jobsFiltered = jobsFiltered.filter((j) => !j.enabled);
  if (state.jobListDomain !== 'all') jobsFiltered = jobsFiltered.filter((j) => (j.domain || 'other') === state.jobListDomain);
  if (state.jobListProvider !== 'all')
    jobsFiltered = jobsFiltered.filter((j) => String(j.provider || '') === state.jobListProvider);
  const q = String(state.jobListQuery || '').trim().toLowerCase();
  if (q) {
    jobsFiltered = jobsFiltered.filter((j) => {
      const hay = `${j.jobKey} ${j.displayName || ''} ${j.description || ''} ${j.provider || ''} ${j.domain || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }
  jobsFiltered = [...jobsFiltered].sort((a, b) => {
    if (state.jobListSort === 'lastRunDesc') {
      const at = new Date(a.lastRunAt || 0).getTime();
      const bt = new Date(b.lastRunAt || 0).getTime();
      return bt - at;
    }
    if (state.jobListSort === 'intervalAsc') return Number(a.intervalSeconds || 0) - Number(b.intervalSeconds || 0);
    const an = String(jobDisplayName(a) || '').toLowerCase();
    const bn = String(jobDisplayName(b) || '').toLowerCase();
    return an.localeCompare(bn);
  });

  const groups = new Map();
  for (const job of jobsFiltered) {
    const key = job.domain || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(job);
  }
  const domains = [...new Set(jobsAll.map((j) => j.domain || 'other'))];
  const providers = [...new Set(jobsAll.map((j) => j.provider).filter(Boolean))];
  $('jobs').innerHTML = `
    <div class="filterBar filterBox">
      <div class="filterBarTitle filterBoxTitle">${esc(textFor('filterSearchConditions'))}</div>
      <div class="filterBarControls toolbar jobsFilterGroups">
        <div class="filterGroup filterGroup--facets">
          <span class="filterGroupTitle">${esc(textFor('filterGroupFilters'))}</span>
          <div class="tabs opTabs" style="margin:0">
            <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">${esc(textFor('tabAll'))}</button>
            <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">${esc(textFor('tabLatest'))}</button>
            <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">${esc(textFor('tabReconcile'))}</button>
          </div>
          <select id="jobListEnabled">
          <option value="all" ${state.jobListEnabled === 'all' ? 'selected' : ''}>${esc(textFor('jobListEnabledAll'))}</option>
          <option value="enabled" ${state.jobListEnabled === 'enabled' ? 'selected' : ''}>${esc(textFor('jobListEnabledOn'))}</option>
          <option value="disabled" ${state.jobListEnabled === 'disabled' ? 'selected' : ''}>${esc(textFor('jobListEnabledOff'))}</option>
          </select>
          <select id="jobListDomain">
          <option value="all">${esc(textFor('jobListDomainAll'))}</option>
          ${domains.map((d) => `<option value="${esc(d)}" ${state.jobListDomain === d ? 'selected' : ''}>${esc(jobGroupTitle(d))}</option>`).join('')}
          </select>
          <select id="jobListProvider">
          <option value="all">${esc(textFor('jobListProviderAll'))}</option>
          ${providers.map((p) => `<option value="${esc(p)}" ${state.jobListProvider === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
          </select>
        </div>
        <div class="filterGroup filterGroup--search">
          <span class="filterGroupTitle">${esc(textFor('filterGroupSearch'))}</span>
          <input id="jobListQuery" class="wide" placeholder="${esc(textFor('jobListQueryPlaceholder'))}" value="${esc(state.jobListQuery)}" />
          <button class="secondary" id="jobListSearch">${esc(textFor('btnSearch'))}</button>
          <button class="secondary" id="jobListReset">${esc(textFor('btnResetQuery'))}</button>
        </div>
        <div class="filterGroup filterGroup--sort">
          <span class="filterGroupTitle">${esc(textFor('filterGroupSort'))}</span>
          <select id="jobListSort">
            <option value="name" ${state.jobListSort === 'name' ? 'selected' : ''}>${esc(textFor('jobListSortName'))}</option>
            <option value="lastRunDesc" ${state.jobListSort === 'lastRunDesc' ? 'selected' : ''}>${esc(textFor('jobListSortLastRun'))}</option>
            <option value="intervalAsc" ${state.jobListSort === 'intervalAsc' ? 'selected' : ''}>${esc(textFor('jobListSortInterval'))}</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card jobDesktopTableCard">
      <table class="settingsTable">
        <thead>
          <tr>
            <th>${esc(textFor('colJob'))}</th>
            <th>${esc(textFor('colStatus'))}</th>
            <th>${esc(textFor('colOperation'))}</th>
            <th>${esc(textFor('colDomain'))}</th>
            <th>${esc(textFor('colProvider'))}</th>
            <th class="right">${esc(textFor('colInterval'))}</th>
            <th>${esc(textFor('colLastRun'))}</th>
            <th class="center">${esc(textFor('colAction'))}</th>
          </tr>
        </thead>
        <tbody>
          ${jobsFiltered
            .map(
              (job) => `
            <tr>
              <td>
                <strong>${esc(jobDisplayName(job))}</strong><br/>
                <span class="muted">${esc(job.jobKey)}</span>
                ${job.description ? `<div class="muted" style="margin-top:4px">${esc(job.description)}</div>` : ''}
              </td>
              <td><span class="pill">${job.enabled ? esc(textFor('jobStatusEnabled')) : esc(textFor('jobStatusDisabled'))}</span></td>
              <td>${operationBadge(job.operation)}</td>
              <td>${domainBadge(job.domain)}</td>
              <td>${providerBadge(job.provider)}</td>
              <td class="right">${esc(jobIntervalLabel(job.intervalSeconds))}</td>
              <td class="muted">${formatDateTime(job.lastRunAt)}</td>
              <td class="center">
                <div class="dataTableActions">
                  <button data-job-run="${esc(job.jobKey)}" class="success">${esc(textFor('btnRun'))}</button>
                  <button class="secondary" data-job-edit-open="${esc(job.jobKey)}">${esc(textFor('jobOpenSettings'))}</button>
                </div>
              </td>
            </tr>
            <tr class="hidden" data-job-edit-row="${esc(job.jobKey)}">
              <td colspan="8">
                <div class="card" style="margin:6px 0 0">
                  ${renderJobEditPanel({ job, esc, textFor, jobDisplayName })}
                </div>
              </td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      ${jobsFiltered.length === 0 ? `<p class="muted">${esc(textFor('jobsEmptyFiltered'))}</p>` : ''}
    </div>
    <div class="mobileJobList">
      ${
        jobsFiltered
          .map(
            (job) => `
              <article class="mobileJobCard">
                <div class="mobileJobCardHead">
                  <div class="mobileJobTitle">
                    <strong>${esc(jobDisplayName(job))}</strong>
                    <span class="muted">${esc(job.jobKey)}</span>
                  </div>
                  <span class="pill ${job.enabled ? 'pillStatus--ok' : 'pillStatus--warn'}">${job.enabled ? esc(textFor('jobStatusEnabled')) : esc(textFor('jobStatusDisabled'))}</span>
                </div>
                ${job.description ? `<div class="mobileJobDesc muted">${esc(job.description)}</div>` : ''}
                <div class="mobileJobMeta">
                  ${operationBadge(job.operation)}
                  ${domainBadge(job.domain)}
                  ${providerBadge(job.provider)}
                  <span class="pill pill--subtle">${esc(jobIntervalLabel(job.intervalSeconds))}</span>
                </div>
                <div class="mobileJobFoot">
                  <span class="muted">${formatDateTime(job.lastRunAt)}</span>
                  <div class="dataTableActions">
                    <button data-job-run="${esc(job.jobKey)}" class="success compactBtn">${esc(textFor('btnRun'))}</button>
                    <button class="secondary compactBtn" data-job-edit-open="${esc(job.jobKey)}">${esc(textFor('jobOpenSettings'))}</button>
                  </div>
                </div>
                <div class="mobileJobEdit hidden" data-job-edit-row="${esc(job.jobKey)}">
                  ${renderJobEditPanel({ job, esc, textFor, jobDisplayName })}
                </div>
              </article>
            `,
          )
          .join('') || `<p class="muted">${esc(textFor('jobsEmptyFiltered'))}</p>`
      }
    </div>
  `;
}

export async function loadJobRunsView(ctx) {
  const {
    api,
    $,
    state,
    esc,
    textFor,
    textForVars,
    renderTableSkeleton,
    jobRunRowSelectKey,
    runStatusPill,
    operationBadge,
    domainBadge,
    providerBadge,
    formatDuration,
    formatDateTime,
    runErrorButton,
  } = ctx;

  const { sortJobRuns } = createJobRunsSort({ state });

  if ($('jobRuns')) $('jobRuns').innerHTML = renderTableSkeleton({ cols: 10, rows: 5 });
  const body = await api(`/admin/api/job-runs?${jobRunsQueryParams({ state, $ })}`);
  state.jobRunsPage = body.page;
  state.jobRunsTotalPages = body.totalPages;
  state.jobRunsTotal = body.total;
  renderJobRunsPager({ targetId: 'jobRunsPagerTop', state, $, esc, textForVars, textFor });
  renderJobRunsPager({ targetId: 'jobRunsPagerBottom', state, $, esc, textForVars, textFor });
  const rows = sortJobRuns(body.data || []);
  state.jobRunsLastRows = rows;
  const validKeys = new Set(rows.map((r) => jobRunRowSelectKey(r)));
  state.jobRunsSelected = (state.jobRunsSelected || []).filter((k) => validKeys.has(String(k)));
  const selected = new Set(state.jobRunsSelected || []);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(jobRunRowSelectKey(r)));

  if (rows.length === 0) {
    $('jobRuns').innerHTML = `<p class="muted">${esc(textFor('jobRunsEmptyMessage'))}</p>`;
    return;
  }

  $('jobRuns').innerHTML = `
    ${
      selected.size
        ? `
          <div class="actionBox" style="margin-bottom:10px">
            <span class="muted">${esc(textForVars('jobRunsSelectedLabel', { count: selected.size }))}</span>
            <div class="row">
              <button class="warning" id="jobRunsBulkRetry">${esc(textFor('jobRunsBulkRetry'))}</button>
              <button class="secondary" id="jobRunsBulkClear">${esc(textFor('jobRunsBulkClearSelection'))}</button>
            </div>
          </div>
        `
        : ''
    }
    <table>
      <thead>
        <tr>
          <th class="center"><input type="checkbox" id="jobRunsSelectAll" ${allSelected ? 'checked' : ''} /></th>
          <th data-run-sort="job">${esc(textFor('colJob'))}</th>
          <th data-run-sort="status">${esc(textFor('colStatus'))}</th>
          <th>${esc(textFor('colOperation'))}</th>
          <th>${esc(textFor('colDomain'))}</th>
          <th>${esc(textFor('colProvider'))}</th>
          <th>${esc(textFor('colTrigger'))}</th>
          <th data-run-sort="progress">${esc(textFor('colProgress'))}</th>
          <th data-run-sort="items" class="right">${esc(textFor('colItems'))}</th>
          <th data-run-sort="duration" class="right">${esc(textFor('colDuration'))}</th>
          <th data-run-sort="finishedAt">${esc(textFor('colFinished'))}</th>
          <th class="center">${esc(textFor('colAction'))}</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((run) => {
            const rowKey = jobRunRowSelectKey(run);
            return `
            <tr class="${jobRunRowClass(run)}">
              <td class="center"><input type="checkbox" data-job-run-select="${esc(rowKey)}" ${selected.has(rowKey) ? 'checked' : ''} /></td>
              <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
              <td>${jobRunStatus({ run, runStatusPill, textFor, esc })}</td>
              <td>${operationBadge(run.operation)}</td>
              <td>${domainBadge(run.domain || run.resultKind)}</td>
              <td>${providerBadge(run.provider)}</td>
              <td>${esc(run.trigger || '-')}</td>
              <td class="muted">${esc(jobRunProgressText({ run, formatDuration, textFor }))}</td>
              <td class="right">${run.itemCount ?? 0}</td>
              <td class="right">${formatDuration(run.durationMs ?? run.elapsedMs)}</td>
              <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
              <td class="center">${runErrorButton(run)}</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
    <div class="mobileRunList">
      ${rows
        .map((run) => {
          const rowKey = jobRunRowSelectKey(run);
          return `
            <article class="mobileRunCard ${mobileJobRunClass(run)}">
              <div class="mobileRunCardHead">
                <label class="mobileRunSelect">
                  <input type="checkbox" data-job-run-select="${esc(rowKey)}" ${selected.has(rowKey) ? 'checked' : ''} />
                  <span class="srOnly">${esc(run.displayName || run.jobKey)}</span>
                </label>
                <div class="mobileJobTitle">
                  <strong>${esc(run.displayName || run.jobKey)}</strong>
                  <span class="muted">${esc(run.jobKey)}</span>
                </div>
                ${jobRunStatus({ run, runStatusPill, textFor, esc })}
              </div>
              <div class="mobileJobMeta">
                ${operationBadge(run.operation)}
                ${domainBadge(run.domain || run.resultKind)}
                ${providerBadge(run.provider)}
                <span class="pill pill--subtle">${esc(run.trigger || '-')}</span>
              </div>
              <div class="mobileRunStats">
                <span>${esc(textFor('colItems'))} <strong>${run.itemCount ?? 0}</strong></span>
                <span>${esc(textFor('colDuration'))} <strong>${esc(formatDuration(run.durationMs ?? run.elapsedMs))}</strong></span>
                <span>${esc(textFor('colFinished'))} <strong>${esc(formatDateTime(run.finishedAt || run.startedAt))}</strong></span>
              </div>
              <div class="mobileJobFoot">
                <span class="muted">${esc(jobRunProgressText({ run, formatDuration, textFor }))}</span>
                ${runErrorButton(run)}
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}
