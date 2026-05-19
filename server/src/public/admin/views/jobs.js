import { timeBasis } from '../format.js';
import { renderIngestWorkflowNav } from './ingestNav.js';
import { mobileRunClass, runProgressText, runRowClass, runStatusPillFor } from './runVisuals.js';

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
  const readonlyValue = (label, value) => `
    <div class="jobReadonlyItem">
      <span>${esc(label)}</span>
      <strong>${esc(value || '-')}</strong>
    </div>
  `;
  return `
    <div class="jobEditPanel" data-job-edit-scope="${esc(job.jobKey)}">
      <div class="row jobEditPanelHead">
        <strong>${esc(textFor('jobEditPanelTitle'))}</strong>
        <button class="secondary compactBtn" data-job-edit-close="${esc(job.jobKey)}">${esc(textFor('btnClose'))}</button>
      </div>
      <div class="jobSettingsBody">
        <label>${esc(textFor('jobLabelName'))} <input data-job-name="${esc(job.jobKey)}" value="${esc(jobDisplayName(job))}" placeholder="${esc(textFor('jobLabelNamePh'))}" /></label>
        <label>${esc(textFor('jobLabelDesc'))} <input data-job-desc="${esc(job.jobKey)}" value="${esc(job.description || '')}" placeholder="${esc(textFor('jobLabelDescPh'))}" /></label>
        <label>${esc(textFor('jobLabelIntervalSec'))} <input data-job-interval="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(job.intervalSeconds)}" /></label>
        <label>${esc(textFor('jobLabelLockTtlSec'))} <input data-job-lock-ttl="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(job.lockTtlSeconds || '')}" placeholder="${esc(textFor('jobLabelLockTtlPh'))}" /></label>
        <label>${esc(textFor('jobLabelStaleLockSec'))} <input data-job-stale-lock="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(job.staleLockSeconds || '')}" placeholder="${esc(textFor('jobLabelStaleLockPh'))}" /></label>
        <label class="jobToggleField">${esc(textFor('jobLabelEnabled'))} <span><input type="checkbox" data-job-enabled="${esc(job.jobKey)}" ${job.enabled ? 'checked' : ''}/> ${esc(textFor('jobEnabledFlag'))}</span></label>
      </div>
      <div class="jobReadonlyGrid">
        ${readonlyValue('Provider', job.provider)}
        ${readonlyValue('Handler', job.handler)}
        ${readonlyValue('Operation', job.operation || 'latest')}
      </div>
      <div class="jobEditActions">
        <button data-job-save="${esc(job.jobKey)}" class="success">${esc(textFor('btnSave'))}</button>
      </div>
    </div>
  `;
}

function jobLastRunAt(job) {
  return job.latestRunAt || job.lastRunAt || null;
}

function jobLastRunStatusText(job, textFor) {
  const status = String(job.latestRunStatus || '').trim();
  if (!status || status === 'completed') return '';
  if (status === 'skipped') return textFor('statusSkipped');
  if (status === 'running') return textFor('statusRunning');
  if (status === 'failed') return textFor('statusFailed');
  return status;
}

function jobLockText(job, textFor) {
  if (!job?.lock?.locked) return '';
  if (job.lock.canForceUnlock) return textFor('jobLockStale');
  return textFor('jobLockActive');
}

function jobForceUnlockButton(job, esc, textFor) {
  if (!job?.lock?.canForceUnlock) return '';
  return `<button class="warning compactBtn" data-job-force-unlock="${esc(job.jobKey)}">${esc(textFor('jobForceUnlock'))}</button>`;
}

function jobHealthClass(job) {
  if (job?.lock?.canForceUnlock) return 'jobCard--staleLock';
  if (job?.lock?.locked) return 'jobCard--locked';
  if (String(job?.latestRunStatus || '') === 'failed') return 'jobCard--failed';
  if (!job?.enabled) return 'jobCard--disabled';
  return 'jobCard--healthy';
}

function renderJobSummary({ jobsAll, jobsFiltered, esc, textFor, textForVars }) {
  const enabled = jobsAll.filter((j) => j.enabled).length;
  const locked = jobsAll.filter((j) => j?.lock?.locked).length;
  const staleLocks = jobsAll.filter((j) => j?.lock?.canForceUnlock).length;
  const failed = jobsAll.filter((j) => String(j.latestRunStatus || '') === 'failed').length;
  const cards = [
    [textFor('jobOpsTotal'), jobsAll.length],
    [textFor('jobOpsEnabled'), enabled],
    [textFor('jobOpsLocked'), locked],
    [textFor('jobOpsStaleLocks'), staleLocks],
    [textFor('jobOpsFailed'), failed],
  ];
  return `
    <div class="jobOpsSummary">
      <div class="jobOpsSummaryHead">
        <strong>${esc(textFor('jobOpsOverview'))}</strong>
        <span class="muted">${esc(textForVars('jobSummaryFiltered', { filtered: jobsFiltered.length, total: jobsAll.length }))}</span>
      </div>
      <div class="jobOpsSummaryGrid">
        ${cards
          .map(
            ([label, value]) => `
              <div class="jobOpsMetric">
                <span>${esc(label)}</span>
                <strong>${esc(value)}</strong>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderJobCard({ job, esc, textFor, jobDisplayName, operationBadge, domainBadge, providerBadge, jobIntervalLabel, formatDateTime }) {
  const lastRunStatus = jobLastRunStatusText(job, textFor);
  const lock = jobLockText(job, textFor);
  const lastRun = jobLastRunAt(job);
  return `
    <article class="jobCard ${jobHealthClass(job)}">
      <div class="jobCardHead">
        <div class="jobCardTitle">
          <strong>${esc(jobDisplayName(job))}</strong>
          <span>${esc(job.jobKey)}</span>
        </div>
        <span class="pill ${job.enabled ? 'pillStatus--ok' : 'pillStatus--warn'}">${job.enabled ? esc(textFor('jobStatusEnabled')) : esc(textFor('jobStatusDisabled'))}</span>
      </div>
      <div class="jobCardDesc">${esc(job.description || textFor('jobNoDescription'))}</div>
      <div class="jobCardBadges">
        ${operationBadge(job.operation)}
        ${domainBadge(job.domain)}
        ${providerBadge(job.provider)}
      </div>
      <div class="jobCardFacts">
        <div>
          <span>${esc(textFor('jobCardSchedule'))}</span>
          <strong>${esc(jobIntervalLabel(job.intervalSeconds))}</strong>
        </div>
        <div>
          <span>${esc(textFor('jobCardLastRun'))}</span>
          <strong>${esc(lastRun ? formatDateTime(lastRun) : textFor('jobCardNeverRun'))}</strong>
        </div>
        ${
          lastRunStatus || lock
            ? `<div class="jobCardAlert">${lastRunStatus ? `<span class="pill pill--subtle">${esc(lastRunStatus)}</span>` : ''}${lock ? `<span class="pill pill--subtle">${esc(lock)}</span>` : ''}</div>`
            : ''
        }
      </div>
      <div class="jobCardActions">
        <button data-job-run="${esc(job.jobKey)}" class="success">${esc(textFor('btnRun'))}</button>
        <button class="secondary" data-open-job-log="${esc(job.jobKey)}">${esc(textFor('jobCardHistory'))}</button>
        ${jobForceUnlockButton(job, esc, textFor)}
        <button class="secondary" data-job-edit-open="${esc(job.jobKey)}">${esc(textFor('jobOpenSettings'))}</button>
      </div>
      <div class="jobCardEdit hidden" data-job-edit-row="${esc(job.jobKey)}">
        ${renderJobEditPanel({ job, esc, textFor, jobDisplayName })}
      </div>
    </article>
  `;
}

export async function loadJobsView(ctx) {
  const {
    api,
    $,
    state,
    esc,
    textFor,
    textForVars,
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
      const at = new Date(jobLastRunAt(a) || 0).getTime();
      const bt = new Date(jobLastRunAt(b) || 0).getTime();
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
    ${renderIngestWorkflowNav({ activeView: 'jobs', esc, textFor })}
    ${renderJobSummary({ jobsAll, jobsFiltered, esc, textFor, textForVars })}
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
    <div class="jobBoard">
      ${
        jobsFiltered.length === 0
          ? `<p class="muted">${esc(textFor('jobsEmptyFiltered'))}</p>`
          : [...groups.entries()]
              .map(
                ([domain, jobs]) => `
                  <section class="jobDomainSection">
                    <div class="jobDomainHead">
                      <div class="jobGroupTitle">
                        <span class="jobGroupIcon">${esc(String(jobGroupTitle(domain)).slice(0, 1))}</span>
                        <strong>${esc(jobGroupTitle(domain))}</strong>
                      </div>
                      <span class="muted">${esc(jobs.length)} ${esc(textFor('jobOpsTotal'))}</span>
                    </div>
                    <div class="jobCardsGrid">
                      ${jobs
                        .map((job) =>
                          renderJobCard({
                            job,
                            esc,
                            textFor,
                            jobDisplayName,
                            operationBadge,
                            domainBadge,
                            providerBadge,
                            jobIntervalLabel,
                            formatDateTime,
                          }),
                        )
                        .join('')}
                    </div>
                  </section>
                `,
              )
              .join('')
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
    $('jobRuns').innerHTML = `
      ${renderIngestWorkflowNav({ activeView: 'jobs', esc, textFor })}
      <p class="muted">${esc(textFor('jobRunsEmptyMessage'))}</p>
    `;
    return;
  }

  $('jobRuns').innerHTML = `
    ${renderIngestWorkflowNav({ activeView: 'jobs', esc, textFor })}
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
            <tr class="${runRowClass(run, { includeStale: false })}">
              <td class="center"><input type="checkbox" data-job-run-select="${esc(rowKey)}" ${selected.has(rowKey) ? 'checked' : ''} /></td>
              <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
              <td>${runStatusPillFor({ run, runStatusPill, textFor, esc, includeStale: false })}</td>
              <td>${operationBadge(run.operation)}</td>
              <td>${domainBadge(run.domain || run.resultKind)}</td>
              <td>${providerBadge(run.provider)}</td>
              <td>${esc(run.trigger || '-')}</td>
              <td class="muted">${esc(runProgressText({ run, formatDuration, textFor }))}</td>
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
            <article class="mobileRunCard ${mobileRunClass(run, { includeStale: false })}">
              <div class="mobileRunCardHead">
                <label class="mobileRunSelect">
                  <input type="checkbox" data-job-run-select="${esc(rowKey)}" ${selected.has(rowKey) ? 'checked' : ''} />
                  <span class="srOnly">${esc(run.displayName || run.jobKey)}</span>
                </label>
                <div class="mobileJobTitle">
                  <strong>${esc(run.displayName || run.jobKey)}</strong>
                  <span class="muted">${esc(run.jobKey)}</span>
                </div>
                ${runStatusPillFor({ run, runStatusPill, textFor, esc, includeStale: false })}
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
                <span class="muted">${esc(runProgressText({ run, formatDuration, textFor }))}</span>
                ${runErrorButton(run)}
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}
