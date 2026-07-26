import { utcRangeForYmd } from '../format.js';
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
    ['status', 'jobRunStatus'],
    ['type', 'jobRunType'],
    ['jobKey', 'jobRunJob'],
    ['trigger', 'jobRunTrigger'],
  ]) {
    const value = $(id).value.trim();
    if (value) params.set(key, value);
  }
  const fromValue = $('jobRunFrom').value.trim();
  const toValue = $('jobRunTo').value.trim();
  if (fromValue) params.set('from', utcRangeForYmd(fromValue).from);
  if (toValue) params.set('to', utcRangeForYmd(toValue).to);
  return params.toString();
}

const JOB_AREA_ORDER = ['news', 'calendar', 'youtube', 'market', 'signal', 'legacy'];
const JOB_STAGE_ORDER = ['ingest', 'enrich', 'maintain'];

function renderJobPresetBar({ presets, esc, textFor }) {
  const items = Array.isArray(presets) ? presets : [];
  if (items.length === 0) return '';
  return `
    <div class="actionBox jobPresetBar">
      <div class="jobPresetBarHead">
        <strong>${esc(textFor('jobPresetTitle'))}</strong>
        <span class="muted">${esc(textFor('jobPresetHint'))}</span>
      </div>
      <div class="row jobPresetButtons">
        ${items
          .map(
            (preset) => `
              <button type="button" class="success" data-job-preset-run="${esc(preset.id)}" title="${esc(textFor(preset.descriptionKey || preset.labelKey))}">
                ${esc(textFor(preset.labelKey))}
              </button>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
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

function groupJobsByAreaStage(jobs) {
  const areas = new Map();
  for (const job of jobs) {
    const area = job.legacy ? 'legacy' : job.area || job.domain || 'legacy';
    const stage = job.stage || 'ingest';
    if (!areas.has(area)) areas.set(area, new Map());
    const stages = areas.get(area);
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage).push(job);
  }
  return areas;
}

function isCommunityIngestJob(job) {
  return job?.domain === 'community' || job?.area === 'community';
}

function renderJobEditPanel({ job, esc, textFor, jobDisplayName, rssSources = [] }) {
  const readonlyValue = (label, value) => `
    <div class="jobReadonlyItem">
      <span>${esc(label)}</span>
      <strong>${esc(value || '-')}</strong>
    </div>
  `;
  const paramsJson = JSON.stringify(job.params || {}, null, 2);
  const afterHoursInstruments = Array.isArray(job.params?.instruments) ? job.params.instruments : [];
  const afterHoursRows = [
    ...afterHoursInstruments,
    ...Array.from({ length: Math.max(1, 3 - afterHoursInstruments.length) }, () => ({})),
  ];
  const afterHoursEditor =
    job.provider === 'hyperliquid' && job.handler === 'korea_after_hours'
      ? `
        <div class="jobSpecialEditor jobAfterHoursEditor">
          <div class="jobSpecialEditorHead">
            <div>
              <strong>${esc(textFor('jobAfterHoursTitle'))}</strong>
              <p class="muted">${esc(textFor('jobAfterHoursHint'))}</p>
            </div>
          </div>
          <div class="jobAfterHoursMetaGrid">
            <label>${esc(textFor('jobAfterHoursDex'))}<input data-job-after-dex="${esc(job.jobKey)}" value="${esc(job.params?.dex || '')}" placeholder="${esc(textFor('jobAfterHoursDexPh'))}" /></label>
            <label>${esc(textFor('jobAfterHoursUsdKrw'))}<input data-job-after-usdkrw="${esc(job.jobKey)}" type="number" min="0" step="0.01" value="${esc(job.params?.fallbackUsdKrw || '')}" placeholder="1400" /></label>
            <label class="jobAfterHoursNotice">${esc(textFor('jobAfterHoursNotice'))}<input data-job-after-notice="${esc(job.jobKey)}" value="${esc(job.params?.notice || '')}" /></label>
          </div>
          <div class="jobAfterHoursTable">
            <div class="jobAfterHoursTableHead">
              <span>${esc(textFor('jobAfterHoursSymbol'))}</span>
              <span>${esc(textFor('jobAfterHoursName'))}</span>
              <span>${esc(textFor('jobAfterHoursDisplaySymbol'))}</span>
              <span>${esc(textFor('jobAfterHoursYahoo'))}</span>
              <span>${esc(textFor('jobAfterHoursCandidates'))}</span>
              <span>${esc(textFor('jobAfterHoursClose'))}</span>
            </div>
            ${afterHoursRows
              .map(
                (row) => `
                  <div class="jobAfterHoursRow" data-job-after-row="${esc(job.jobKey)}">
                    <input data-job-after-symbol="${esc(job.jobKey)}" value="${esc(row.symbol || '')}" placeholder="005930" />
                    <input data-job-after-name="${esc(job.jobKey)}" value="${esc(row.name || '')}" placeholder="${esc(textFor('jobAfterHoursNamePh'))}" />
                    <input data-job-after-display="${esc(job.jobKey)}" value="${esc(row.displaySymbol || '')}" placeholder="${esc(textFor('jobAfterHoursDisplaySymbolPh'))}" />
                    <input data-job-after-yahoo="${esc(job.jobKey)}" value="${esc(row.yahooSymbol || '')}" placeholder="005930.KS" />
                    <input data-job-after-candidates="${esc(job.jobKey)}" value="${esc(Array.isArray(row.candidates) ? row.candidates.join(', ') : row.hyperliquidSymbol || '')}" placeholder="SAMSUNG, 005930" />
                    <input data-job-after-close="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(row.regularCloseKrw ?? '')}" placeholder="${esc(textFor('jobAfterHoursClosePh'))}" />
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      `
      : '';
  const selectedRssIds = new Set(
    Array.isArray(job.params?.rssSourceIds)
      ? job.params.rssSourceIds.map(String)
      : job.params?.rssSourceId
        ? [String(job.params.rssSourceId)]
        : [],
  );
  const communityPageSize = Math.min(50, Math.max(5, Number(job.params?.pageSize) || 30));
  const communitySourceHint =
    job.handler === 'likeusstock_free'
      ? textFor('jobCommunitySourceNaver')
      : job.handler === 'user_news'
        ? textFor('jobCommunitySourceSave')
        : textFor('jobCommunitySourceGeneric');
  const communityEditor = isCommunityIngestJob(job)
    ? `
        <div class="jobSpecialEditor jobCommunityEditor">
          <div class="jobSpecialEditorHead">
            <div>
              <strong>${esc(textFor('jobCommunityTitle'))}</strong>
              <p class="muted">${esc(communitySourceHint)}</p>
            </div>
          </div>
          <div class="jobCommunityMetaGrid">
            <label class="fieldLabel">${esc(textFor('jobCommunityPageSize'))}
              <select data-job-community-pagesize="${esc(job.jobKey)}">
                ${[5, 10, 15, 20, 30, 40, 50]
                  .map(
                    (size) =>
                      `<option value="${size}" ${communityPageSize === size ? 'selected' : ''}>${esc(textFor('jobCommunityPageSizeOption').replace('{{count}}', String(size)))}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <p class="muted jobCommunityHint">${esc(textFor('jobCommunityPageSizeHint'))}</p>
          </div>
        </div>
      `
    : '';
  const rssSelector =
    job.provider === 'rss'
      ? `
        <div class="jobRssSourcePicker">
          <span class="muted">${esc(textFor('jobRssSourcesLabel'))}</span>
          <div class="jobRssSourceGrid">
            ${(rssSources || [])
              .filter((source) => source && source.hidden !== true)
              .map(
                (source) => `
                  <label class="switchRow jobRssSourceOption">
                    <input type="checkbox" data-job-rss-source="${esc(job.jobKey)}" value="${esc(source.id)}" ${
                      selectedRssIds.has(String(source.id)) ? 'checked' : ''
                    } />
                    <span>${esc(source.name || source.id)}</span>
                  </label>
                `,
              )
              .join('') || `<span class="muted">${esc(textFor('rssSourcesEmpty'))}</span>`}
          </div>
        </div>
      `
      : '';
  return `
    <div class="jobEditPanel" data-job-edit-scope="${esc(job.jobKey)}">
      <div class="jobEditPanelHead">
        <div class="jobEditPanelTitle">
          <i class="ti ti-settings" aria-hidden="true" style="font-size:15px;opacity:0.6;margin-right:6px;vertical-align:-2px"></i>
          <strong>${esc(jobDisplayName(job))}</strong>
          <code class="jobEditPanelKey">${esc(job.jobKey)}</code>
        </div>
        <button class="secondary compactBtn" data-job-edit-close="${esc(job.jobKey)}">${esc(textFor('btnClose'))}</button>
      </div>

      <div class="jobEditSection">
        <div class="jobEditSectionHead">
          <strong>${esc(textFor('jobEditBasicTitle'))}</strong>
        </div>
        <div class="jobSettingsIdentity">
          <label class="fieldLabel">${esc(textFor('jobLabelName'))}
            <input data-job-name="${esc(job.jobKey)}" value="${esc(jobDisplayName(job))}" placeholder="${esc(textFor('jobLabelNamePh'))}" />
          </label>
          <label class="fieldLabel">${esc(textFor('jobLabelDesc'))}
            <input data-job-desc="${esc(job.jobKey)}" value="${esc(job.description || '')}" placeholder="${esc(textFor('jobLabelDescPh'))}" />
          </label>
        </div>
        <label class="switchRow jobEnabledToggle">
          <input class="switchInput" type="checkbox" data-job-enabled="${esc(job.jobKey)}" ${job.enabled ? 'checked' : ''}/>
          <span class="switchUi" aria-hidden="true"></span>
          <span>${esc(textFor('jobLabelEnabled'))}</span>
        </label>
      </div>

      <div class="jobEditSection">
        <div class="jobEditSectionHead">
          <strong>${esc(textFor('jobEditScheduleTitle'))}</strong>
        </div>
        <div class="jobSettingsSchedule">
          <label class="fieldLabel">${esc(textFor('jobLabelIntervalSec'))}
            <input data-job-interval="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(job.intervalSeconds)}" />
          </label>
          <label class="fieldLabel">${esc(textFor('jobLabelLockTtlSec'))}
            <input data-job-lock-ttl="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(job.lockTtlSeconds || '')}" placeholder="${esc(textFor('jobLabelLockTtlPh'))}" />
          </label>
          <label class="fieldLabel">${esc(textFor('jobLabelStaleLockSec'))}
            <input data-job-stale-lock="${esc(job.jobKey)}" type="number" min="0" step="1" value="${esc(job.staleLockSeconds || '')}" placeholder="${esc(textFor('jobLabelStaleLockPh'))}" />
          </label>
        </div>
        <div class="jobIntervalPresets" role="group" aria-label="${esc(textFor('jobIntervalPresetsLabel'))}">
          ${[
            [30, 'jobIntervalPreset30s'],
            [60, 'jobIntervalPreset1m'],
            [300, 'jobIntervalPreset5m'],
            [900, 'jobIntervalPreset15m'],
            [1800, 'jobIntervalPreset30m'],
            [3600, 'jobIntervalPreset1h'],
          ]
            .map(
              ([sec, labelKey]) => `
                <button type="button" class="secondary compactBtn ${Number(job.intervalSeconds) === sec ? 'active' : ''}" data-job-interval-preset="${esc(job.jobKey)}" data-seconds="${sec}">
                  ${esc(textFor(labelKey))}
                </button>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="jobEditSection">
        <div class="jobEditSectionHead">
          <strong>${esc(textFor('jobEditSourceTitle'))}</strong>
        </div>
        <div class="jobReadonlyGrid">
          ${readonlyValue('Provider', job.provider)}
          ${readonlyValue('Handler', job.handler)}
          ${readonlyValue('Operation', job.operation || 'latest')}
        </div>
        ${rssSelector}
        ${communityEditor}
        ${afterHoursEditor}
      </div>

      <details class="jobAdvancedParams">
        <summary>${esc(textFor('jobParamsJson'))}</summary>
        <label class="jobParamsField">
          <textarea data-job-params-json="${esc(job.jobKey)}" rows="8" spellcheck="false">${esc(paramsJson)}</textarea>
          <small class="muted">${esc(textFor('jobParamsJsonHint'))}</small>
        </label>
      </details>

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

function jobLockText(job, textFor, textForVars, formatDateTime) {
  if (!job?.lock?.locked) return '';
  if (job.lock.canForceUnlock) {
    const reasonKey = {
      expired: 'jobLockReasonExpired',
      quiet_ttl: 'jobLockReasonQuiet',
      running_ttl: 'jobLockReasonRunning',
      orphaned_lock: 'jobLockReasonOrphan',
      completed_run: 'jobLockReasonCompletedRun',
    }[job.lock.reason];
    return reasonKey ? textFor(reasonKey) : textFor('jobLockStale');
  }
  const expiresAt = job.lock.expiresAt ? formatDateTime(job.lock.expiresAt) : '-';
  return textForVars('jobLockActiveUntil', { time: expiresAt });
}

function jobForceUnlockButton(job, esc, textFor) {
  if (!job?.lock?.canForceUnlock) return '';
  return `<button class="warning compactBtn" data-job-force-unlock="${esc(job.jobKey)}">${esc(textFor('jobForceUnlock'))}</button>`;
}

function jobConfigSummary(job, rssSources, textFor) {
  const params = job?.params && typeof job.params === 'object' ? job.params : {};
  if (job.provider === 'rss') {
    const ids = Array.isArray(params.rssSourceIds) ? params.rssSourceIds : params.rssSourceId ? [params.rssSourceId] : [];
    const names = ids
      .map((id) => (rssSources || []).find((source) => String(source.id) === String(id))?.name || id)
      .filter(Boolean);
    if (names.length > 0) {
      const preview = names.slice(0, 2).join(', ');
      return names.length > 2 ? textFor('jobConfigRssSummary').replace('{{count}}', names.length).replace('{{preview}}', preview) : preview;
    }
    return textFor('jobConfigNoRss');
  }
  if (job.provider === 'hyperliquid' && job.handler === 'korea_after_hours') {
    const count = Array.isArray(params.instruments) ? params.instruments.filter(Boolean).length : 0;
    return textFor('jobConfigAfterHoursSummary')
      .replace('{{count}}', count)
      .replace('{{usdkrw}}', params.fallbackUsdKrw ? String(params.fallbackUsdKrw) : '-');
  }
  if (isCommunityIngestJob(job)) {
    const pageSize = Math.min(50, Math.max(5, Number(params.pageSize) || 30));
    return textFor('jobConfigCommunitySummary').replace('{{count}}', String(pageSize));
  }
  const keys = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '');
  return keys.length > 0 ? textFor('jobConfigParamsSummary').replace('{{count}}', keys.length) : textFor('jobConfigNoParams');
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
  const activeLocks = jobsAll.filter((j) => j?.lock?.locked).length;
  const staleLocks = jobsAll.filter((j) => j?.lock?.canForceUnlock).length;
  const failed = jobsAll.filter((j) => String(j.latestRunStatus || '') === 'failed').length;
  const cards = [
    [textFor('jobOpsTotal'), jobsAll.length],
    [textFor('jobOpsEnabled'), enabled],
    [textFor('jobOpsLocked'), activeLocks],
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

function renderJobCard({ job, selected, esc, textFor, textForVars, jobDisplayName, operationBadge, areaBadge, stageBadge, providerBadge, jobIntervalLabel, formatDateTime, rssSources }) {
  const lastRunStatus = jobLastRunStatusText(job, textFor);
  const lock = jobLockText(job, textFor, textForVars, formatDateTime);
  const lastRun = jobLastRunAt(job);
  const checked = selected.has(job.jobKey);
  const configSummary = jobConfigSummary(job, rssSources, textFor);
  const alertBits = [
    lastRunStatus ? `<span class="pill pill--subtle">${esc(lastRunStatus)}</span>` : '',
    lock ? `<span class="pill pill--subtle">${esc(lock)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  return `
    <article class="jobCard ${jobHealthClass(job)} ${checked ? 'jobCard--selected' : ''}">
      <div class="jobCardLine">
        <label class="jobCardSelect">
          <input type="checkbox" data-job-list-select="${esc(job.jobKey)}" ${checked ? 'checked' : ''} />
          <span class="srOnly">${esc(jobDisplayName(job))}</span>
        </label>
        <div class="jobCardMain">
          <div class="jobCardHead">
            <div class="jobCardTitle">
              <strong>${esc(jobDisplayName(job))}</strong>
              <span class="jobCardKey">${esc(job.jobKey)}</span>
            </div>
            <label class="switchRow jobCardEnabledSwitch" title="${esc(textFor('jobLabelEnabled'))}">
              <input class="switchInput" type="checkbox" data-job-quick-enabled="${esc(job.jobKey)}" ${job.enabled ? 'checked' : ''} />
              <span class="switchUi" aria-hidden="true"></span>
              <span class="jobCardEnabledLabel">${job.enabled ? esc(textFor('jobStatusEnabled')) : esc(textFor('jobStatusDisabled'))}</span>
            </label>
          </div>
          <button type="button" class="jobCardDesc jobCardEditTrigger" data-job-edit-open="${esc(job.jobKey)}">${esc(job.description || textFor('jobNoDescription'))}</button>
          <div class="jobCardBadges">
            ${stageBadge(job.stage)}
            ${operationBadge(job.operation)}
            ${areaBadge(job.area || job.domain)}
            ${providerBadge(job.provider)}
          </div>
        </div>
        <div class="jobCardSide">
          <div class="jobCardFacts">
            <div>
              <span>${esc(textFor('jobCardSchedule'))}</span>
              <strong>${esc(jobIntervalLabel(job.intervalSeconds))}</strong>
            </div>
            <div>
              <span>${esc(textFor('jobCardLastRun'))}</span>
              <strong>${esc(lastRun ? formatDateTime(lastRun) : textFor('jobCardNeverRun'))}</strong>
            </div>
            <div>
              <span>${esc(textFor('jobConfigSummary'))}</span>
              <strong title="${esc(configSummary)}">${esc(configSummary)}</strong>
            </div>
          </div>
          ${alertBits ? `<div class="jobCardAlert">${alertBits}</div>` : ''}
          <div class="jobCardActions">
            <button type="button" data-job-run="${esc(job.jobKey)}" class="success compactBtn">${esc(textFor('btnRun'))}</button>
            <button type="button" class="secondary compactBtn" data-open-job-log="${esc(job.jobKey)}">${esc(textFor('jobCardHistory'))}</button>
            ${jobForceUnlockButton(job, esc, textFor)}
            <button type="button" class="secondary compactBtn" data-job-edit-open="${esc(job.jobKey)}">${esc(textFor('jobOpenSettings'))}</button>
          </div>
        </div>
      </div>
      <div class="jobCardEdit hidden" data-job-edit-row="${esc(job.jobKey)}">
        ${renderJobEditPanel({ job, esc, textFor, jobDisplayName, rssSources })}
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
    areaGroupTitle,
    stageGroupTitle,
    operationBadge,
    areaBadge,
    stageBadge,
    providerBadge,
    jobIntervalLabel,
    formatDateTime,
  } = ctx;

  const [body, rssSourcesBody] = await Promise.all([
    api('/admin/api/jobs'),
    api('/admin/api/rss-sources?includeHidden=1'),
  ]);
  state.jobs = body.data;
  state.jobPresets = Array.isArray(body.presets) ? body.presets : [];
  state.rssSources = Array.isArray(rssSourcesBody.data) ? rssSourcesBody.data : [];
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
  let jobsFiltered = jobsAll;

  if (state.stageFilter && state.stageFilter !== 'all') {
    jobsFiltered = jobsFiltered.filter((j) => (j.stage || 'ingest') === state.stageFilter);
  }
  if (state.operationFilter && state.operationFilter !== 'all') {
    jobsFiltered = jobsFiltered.filter((j) => {
      const op = String(j.operation || 'latest').toLowerCase();
      if (state.operationFilter === 'sync') return op === 'sync';
      if (state.operationFilter === 'digest') return op === 'digest';
      if (state.operationFilter === 'reconcile') return op === 'reconcile';
      if (state.operationFilter === 'latest') return op === 'latest' || op === 'popular';
      return true;
    });
  }

  if (state.jobListEnabled === 'enabled') jobsFiltered = jobsFiltered.filter((j) => !!j.enabled);
  if (state.jobListEnabled === 'disabled') jobsFiltered = jobsFiltered.filter((j) => !j.enabled);
  if (state.jobListArea !== 'all') jobsFiltered = jobsFiltered.filter((j) => (j.area || j.domain || 'legacy') === state.jobListArea);
  if (state.jobListProvider !== 'all')
    jobsFiltered = jobsFiltered.filter((j) => String(j.provider || '') === state.jobListProvider);
  const q = String(state.jobListQuery || '').trim().toLowerCase();
  if (q) {
    jobsFiltered = jobsFiltered.filter((j) => {
      const hay = `${j.jobKey} ${j.displayName || ''} ${j.description || ''} ${j.provider || ''} ${j.area || ''} ${j.domain || ''} ${j.stage || ''}`.toLowerCase();
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

  const areaGroups = groupJobsByAreaStage(jobsFiltered);
  state.jobsFilteredLast = jobsFiltered.map((job) => job.jobKey).filter(Boolean);
  const validKeys = new Set(state.jobsFilteredLast);
  state.jobListSelected = (state.jobListSelected || []).filter((key) => validKeys.has(String(key)));
  const selected = new Set(state.jobListSelected || []);

  const areas = [...new Set(jobsAll.map((j) => j.area || j.domain || 'legacy'))].sort(
    (a, b) => JOB_AREA_ORDER.indexOf(a) - JOB_AREA_ORDER.indexOf(b),
  );
  const providers = [...new Set(jobsAll.map((j) => j.provider).filter(Boolean))];
  const orderedAreaEntries = [...areaGroups.entries()].sort(
    (a, b) => JOB_AREA_ORDER.indexOf(a[0]) - JOB_AREA_ORDER.indexOf(b[0]),
  );
  $('jobs').innerHTML = `
    ${renderIngestWorkflowNav({ activeView: 'jobs', esc, textFor })}
    ${renderJobSummary({ jobsAll, jobsFiltered, esc, textFor, textForVars })}
    ${renderJobPresetBar({ presets: state.jobPresets, esc, textFor })}
    <div class="filterBar filterBox">
      <div class="filterBarTitle filterBoxTitle">${esc(textFor('filterSearchConditions'))}</div>
      <div class="filterBarControls toolbar jobsFilterGroups">
        <div class="filterGroup filterGroup--facets">
          <span class="filterGroupTitle">${esc(textFor('filterGroupFilters'))}</span>
          <div class="tabs opTabs" style="margin:0">
            <button class="tabBtn ${state.stageFilter === 'all' ? 'active' : ''}" data-stage-filter="all">${esc(textFor('tabAll'))}</button>
            <button class="tabBtn ${state.stageFilter === 'ingest' ? 'active' : ''}" data-stage-filter="ingest">${esc(textFor('stageIngest'))}</button>
            <button class="tabBtn ${state.stageFilter === 'enrich' ? 'active' : ''}" data-stage-filter="enrich">${esc(textFor('stageEnrich'))}</button>
            <button class="tabBtn ${state.stageFilter === 'maintain' ? 'active' : ''}" data-stage-filter="maintain">${esc(textFor('stageMaintain'))}</button>
          </div>
          <select id="jobListArea">
          <option value="all">${esc(textFor('jobListAreaAll'))}</option>
          ${areas.map((d) => `<option value="${esc(d)}" ${state.jobListArea === d ? 'selected' : ''}>${esc(areaGroupTitle(d))}</option>`).join('')}
          </select>
          <select id="jobListEnabled">
          <option value="all" ${state.jobListEnabled === 'all' ? 'selected' : ''}>${esc(textFor('jobListEnabledAll'))}</option>
          <option value="enabled" ${state.jobListEnabled === 'enabled' ? 'selected' : ''}>${esc(textFor('jobListEnabledOn'))}</option>
          <option value="disabled" ${state.jobListEnabled === 'disabled' ? 'selected' : ''}>${esc(textFor('jobListEnabledOff'))}</option>
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
    ${
      jobsFiltered.length
        ? `
          <div class="actionBox jobListBulkBar">
            <span class="muted">${esc(textForVars('jobListSelectedLabel', { count: selected.size }))}</span>
            <div class="row">
              <button type="button" class="secondary" id="jobListSelectAll">${esc(textFor('jobListSelectAll'))}</button>
              <button type="button" class="secondary" id="jobListClearSelection">${esc(textFor('jobListClearSelection'))}</button>
              <button type="button" class="success" id="jobListBulkRun" ${selected.size ? '' : 'disabled'}>${esc(textFor('btnRunSelected'))}</button>
            </div>
          </div>
        `
        : ''
    }
    <div class="jobBoard">
      ${
        jobsFiltered.length === 0
          ? `<p class="muted">${esc(textFor('jobsEmptyFiltered'))}</p>`
          : orderedAreaEntries
              .map(([area, stageMap]) => {
                const stageEntries = [...stageMap.entries()].sort(
                  (a, b) => JOB_STAGE_ORDER.indexOf(a[0]) - JOB_STAGE_ORDER.indexOf(b[0]),
                );
                const jobCount = stageEntries.reduce((sum, [, jobs]) => sum + jobs.length, 0);
                const collapsed = area === 'legacy' ? ' jobAreaSection--collapsed' : '';
                return `
                  <section class="jobAreaSection${collapsed}">
                    <div class="jobAreaHead">
                      <div class="jobGroupTitle">
                        <span class="jobGroupIcon">${esc(String(areaGroupTitle(area)).slice(0, 1))}</span>
                        <strong>${esc(areaGroupTitle(area))}</strong>
                      </div>
                      <span class="muted">${esc(jobCount)} ${esc(textFor('jobOpsTotal'))}</span>
                    </div>
                    ${stageEntries
                      .map(
                        ([stage, jobs]) => `
                          <div class="jobStageSection">
                            <div class="jobStageHead">
                              <strong>${esc(stageGroupTitle(stage))}</strong>
                              <span class="muted">${esc(jobs.length)}</span>
                            </div>
                            <div class="jobCardsGrid">
                              ${jobs
                                .map((job) =>
                                  renderJobCard({
                                    job,
                                    selected,
                                    esc,
                                    textFor,
                                    textForVars,
                                    jobDisplayName,
                                    operationBadge,
                                    areaBadge,
                                    stageBadge,
                                    providerBadge,
                                    jobIntervalLabel,
                                    formatDateTime,
                                    rssSources: state.rssSources,
                                  }),
                                )
                                .join('')}
                            </div>
                          </div>
                        `,
                      )
                      .join('')}
                  </section>
                `;
              })
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
