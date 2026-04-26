import { api } from './api.js';
import { esc, formatDateTime, jobIntervalLabel, ymd } from './format.js';
import { applyAdminLanguage } from './i18n.js';
import { $, state } from './state.js';
import { applyTheme } from './theme.js';

      let toastTimer = null;
      function showToast(title, detail = '') {
        const host = $('toastHost');
        if (!host) return;
        if (toastTimer) clearTimeout(toastTimer);
        host.classList.remove('hidden');
        host.innerHTML = `
          <div class="toast">
            <strong>${esc(title)}</strong>
            <span class="muted">${esc(detail)}</span>
          </div>
        `;
        toastTimer = setTimeout(() => {
          host.classList.add('hidden');
          host.innerHTML = '';
          toastTimer = null;
        }, 2200);
      }

      function uniq(arr) {
        const out = [];
        for (const v of arr || []) {
          const s = String(v || '').trim();
          if (!s) continue;
          if (!out.includes(s)) out.push(s);
        }
        return out;
      }

      function modelPresetsForProvider(provider, defaultModel) {
        const p = String(provider || '').trim().toLowerCase();
        const fromSettings = state.uiModelPresets && typeof state.uiModelPresets === 'object' ? state.uiModelPresets[p] : null;
        const base = Array.isArray(fromSettings) ? fromSettings : [];
        return uniq([defaultModel, ...base]);
      }

      function renderModelOptions(options, selected) {
        const sel = String(selected || '');
        return (options || []).map((m) => `<option value="${esc(m)}" ${m === sel ? 'selected' : ''}>${esc(m)}</option>`).join('');
      }

      function refreshTranslationTestModels(providerSettings) {
        const provider = $('translationTestProvider')?.value || 'mock';
        const defaultModel =
          (providerSettings || []).find((p) => p.provider === provider)?.defaultModel || '';
        const models = modelPresetsForProvider(provider, defaultModel);
        const current = $('translationTestModel')?.value || '';
        if ($('translationTestModel')) {
          $('translationTestModel').innerHTML =
            models.length > 0 ? renderModelOptions(models, models.includes(current) ? current : (defaultModel || models[0])) : '<option value="">-</option>';
        }
      }

      function setDatePresetFor(prefix) {
        const preset = $(`${prefix}Range`).value;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let from = null;
        let to = null;
        if (preset === 'today') from = to = today;
        if (preset === 'yesterday') {
          from = new Date(today);
          from.setDate(from.getDate() - 1);
          to = from;
        }
        if (preset === '7d') {
          from = new Date(today);
          from.setDate(from.getDate() - 6);
          to = today;
        }
        if (preset === '30d') {
          from = new Date(today);
          from.setDate(from.getDate() - 29);
          to = today;
        }
        if (preset !== 'custom') {
          $(`${prefix}From`).value = from ? ymd(from) : '';
          $(`${prefix}To`).value = to ? ymd(to) : '';
        }
      }

      function setDatePreset() {
        setDatePresetFor('news');
      }

      function setJobRunDatePreset() {
        setDatePresetFor('jobRun');
      }

      function setCalendarDatePreset() {
        setDatePresetFor('calendar');
      }

      if ($('calendarRange')) {
        $('calendarRange').addEventListener('change', () => setCalendarDatePreset());
        setCalendarDatePreset();
      }

      const domainLabels = {
        news: '뉴스',
        calendar: '캘린더',
        youtube: '유튜브',
        market: '마켓',
      };

      const operationLabels = {
        latest: '최신 수집',
        reconcile: '보정 수집',
        maintenance: '유지보수',
      };

      const domainIcons = {
        news: '📰',
        calendar: '📅',
        youtube: '▶',
        market: '💹',
      };

      function jobDisplayName(job) {
        return job.displayName || job.jobKey;
      }

      function jobGroupTitle(domain) {
        return domainLabels[domain] || domain || '기타';
      }

      function operationBadge(operation) {
        const op = operation || 'latest';
        const css = op === 'reconcile' ? 'opReconcile' : op === 'latest' ? 'opLatest' : 'opMaintenance';
        return `<span class="pill ${css}">${esc(operationLabels[op] || op || '-')}</span>`;
      }


      async function switchView(view) {
        const requestedView = view;
        const settingsTabFromView =
          requestedView === 'settings-keys'
            ? 'keys'
            : requestedView === 'settings-theme'
              ? 'theme'
              : requestedView === 'settings-lists'
                ? 'lists'
                : requestedView === 'settings-danger'
                  ? 'danger'
                  : null;
        const actualView = settingsTabFromView ? 'settings' : requestedView;

        const panel = $(`view-${actualView}`);
        const resolvedView = panel ? actualView : 'dashboard';
        state.view = requestedView;
        document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
        $(`view-${resolvedView}`)?.classList.remove('hidden');
        document.querySelectorAll('[data-view]').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.view === requestedView);
          btn.classList.toggle('secondary', btn.dataset.view !== requestedView);
        });

        // Lazy-load data for views that need it.
        if (resolvedView === 'calendar') void loadCalendar();
        if (resolvedView === 'monitoring') void loadMonitoring();
        if (resolvedView === 'errors') void loadErrors();
        if (resolvedView === 'settings') {
          setSettingsTab(settingsTabFromView || state.settingsTab || 'keys');
          const title = $('settingsTitle');
          if (title) {
            title.textContent =
              settingsTabFromView === 'theme'
                ? '테마'
                : settingsTabFromView === 'lists'
                  ? '마켓 리스트'
                  : settingsTabFromView === 'danger'
                    ? '데이터 초기화'
                    : 'Provider 키관리';
          }
        }
      }

      function setJobTab(tab) {
        state.jobTab = tab;
        document.querySelectorAll('[data-job-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.jobTab === tab));
        $('jobs').classList.toggle('hidden', tab !== 'info');
        $('jobRunsPanel').classList.toggle('hidden', tab !== 'runs');
        if (tab === 'runs') void loadJobRuns();
      }

      function setSettingsTab(tab) {
        state.settingsTab = tab;
        document.querySelectorAll('[data-settings-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.settingsTab === tab));
        document.querySelectorAll('.settingsTab').forEach((el) => el.classList.add('hidden'));
        $(`settingsTab-${tab}`)?.classList.remove('hidden');
      }

      async function refreshSession() {
        const body = await api('/admin/api/session');
        const loggedIn = !!body.adminId;
        $('session').textContent = loggedIn ? `${body.adminId}` : 'logout';
        document.body.classList.toggle('loginMode', !loggedIn);
        $('loginPanel').classList.toggle('hidden', loggedIn);
        $('adminPanel').classList.toggle('hidden', !loggedIn);
        $('logoutBtn').classList.toggle('hidden', !loggedIn);
        if (loggedIn) {
          setDatePreset();
          setJobRunDatePreset();
          setCalendarDatePreset();
          await Promise.all([
            loadDashboard(),
            loadMonitoring(),
            loadErrors(),
            loadJobs(),
            loadJobRuns(),
            loadTranslationSettings(),
            loadProviderSettings(),
            loadMarketLists(),
            loadNews(),
            loadCalendar(),
            loadYoutube(),
          ]);
        }
      }

      function runButton(jobKey, label = '실행') {
        return `<button class="success" data-job-run="${esc(jobKey)}">${esc(label)}</button>`;
      }

      function statusPill(status) {
        const s = String(status || '-');
        return `<span class="pill">${esc(s)}</span>`;
      }

      async function loadMonitoring() {
        if (!$('monitoring')) return;
        const summary = (await api('/admin/api/summary')).data;
        const runsAll = summary.recentRuns || [];
        const runs = state.operationFilter === 'all' ? runsAll : runsAll.filter((r) => (r.operation || 'latest') === state.operationFilter);
        const stale = runs.filter((r) => r.stale);
        $('monitoring').innerHTML = `
          <div class="tabs" style="margin-bottom:10px">
            <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">전체</button>
            <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">최신</button>
            <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">보정</button>
          </div>
          <div class="statGrid wideStats">
            <div class="stat"><div class="muted">최근 실행</div><div class="statNum">${runs.length}</div></div>
            <div class="stat"><div class="muted">주기 초과</div><div class="statNum">${stale.length}</div></div>
            <div class="stat"><div class="muted">활성 Job</div><div class="statNum">${summary.counts.enabledJobs}</div></div>
            <div class="stat"><div class="muted">최근 실패</div><div class="statNum">${summary.counts.recentFailedRuns}</div></div>
          </div>
          <h3 style="margin-top:16px">워커 상태(최근 실행)</h3>
          <table>
            <thead><tr><th>Job</th><th>상태</th><th>타입</th><th>Items</th><th>Finished</th><th>액션</th></tr></thead>
            <tbody>
              ${runs.map((run) => `
                <tr class="${run.stale ? 'staleRow' : ''}">
                  <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                  <td>${run.stale ? '<span class="pill opReconcile">주기 초과</span>' : statusPill(run.status || 'not run')}</td>
                  <td>${operationBadge(run.operation)}<br/><span class="muted">${esc(run.resultKind || run.domain || '-')} · ${esc(run.provider || '-')}</span></td>
                  <td>${run.itemCount ?? 0}</td>
                  <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
                  <td class="row">
                    ${runButton(run.jobKey, '즉시 실행')}
                    <button class="secondary" data-open-job-log="${esc(run.jobKey)}">오류/로그</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="muted" style="margin-top:10px">팁: 느린 Job(예: 시총 상위 시세)은 Job 로그에서 Progress(%)를 확인할 수 있습니다.</div>
        `;
      }

      async function loadErrors() {
        if (!$('errors')) return;
        const body = await api(`/admin/api/job-runs?${new URLSearchParams({ status: 'failed', pageSize: '30', page: '1' }).toString()}`);
        const all = Array.isArray(body.data) ? body.data : [];
        const filtered = state.operationFilter === 'all' ? all : all.filter((r) => (r.operation || 'latest') === state.operationFilter);
        $('errors').innerHTML = `
          <div class="tabs" style="margin-bottom:10px">
            <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">전체</button>
            <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">최신</button>
            <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">보정</button>
          </div>
        ` + (filtered.length === 0
          ? '<p class="muted">최근 오류가 없습니다.</p>'
          : `
              <table>
                <thead>
                  <tr><th>Job</th><th>Status</th><th>Type</th><th>Trigger</th><th>Duration</th><th>Started</th><th>Error</th><th>액션</th></tr>
                </thead>
                <tbody>
                  ${filtered.map((run) => `
                    <tr>
                      <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                      <td><span class="pill">${esc(run.status)}</span></td>
                      <td>${operationBadge(run.operation)}<br/><span class="muted">${esc(run.resultKind || run.domain || '-')} · ${esc(run.provider || '-')}</span></td>
                      <td>${esc(run.trigger || '-')}</td>
                      <td>${formatDuration(run.durationMs)}</td>
                      <td class="muted">${formatDateTime(run.startedAt)}</td>
                      <td class="error">${esc(run.errorMessage || '-')}</td>
                      <td>${runButton(run.jobKey, '재시도')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `);
      }

      async function loadDashboard() {
        const summary = (await api('/admin/api/summary')).data;
        const allRuns = Array.isArray(summary.recentRuns) ? summary.recentRuns : [];
        const opFiltered = state.dashboardOperationFilter === 'all'
          ? allRuns
          : allRuns.filter((r) => (r.operation || 'latest') === state.dashboardOperationFilter);
        const sorted = [...opFiltered].sort((a, b) => {
          if (state.dashboardSort === 'name') {
            const an = String(a.displayName || a.jobKey || '').toLowerCase();
            const bn = String(b.displayName || b.jobKey || '').toLowerCase();
            return an.localeCompare(bn);
          }
          const at = new Date(a.finishedAt || a.startedAt || 0).getTime();
          const bt = new Date(b.finishedAt || b.startedAt || 0).getTime();
          return state.dashboardSort === 'oldest' ? (at - bt) : (bt - at);
        });
        $('dashboard').innerHTML = `
          <div class="statGrid wideStats">
            <div class="stat"><div class="muted">📰 뉴스</div><div class="statNum">${summary.counts.news}</div></div>
            <div class="stat"><div class="muted">📅 캘린더</div><div class="statNum">${summary.counts.calendar}</div></div>
            <div class="stat"><div class="muted">▶ 유튜브</div><div class="statNum">${summary.counts.youtube}</div></div>
            <div class="stat"><div class="muted">💹 시세</div><div class="statNum">${summary.counts.marketQuotes || 0}</div></div>
            <div class="stat"><div class="muted">🪙 코인</div><div class="statNum">${summary.counts.coinMarkets || 0}</div></div>
            <div class="stat"><div class="muted">활성 Job</div><div class="statNum">${summary.counts.enabledJobs}</div></div>
          </div>
          <div class="row" style="justify-content:space-between;margin-top:16px">
            <h3 style="margin:0">최근 실행</h3>
            <div class="row">
              <div class="tabs" style="margin:0">
                <button class="tabBtn ${state.dashboardOperationFilter === 'all' ? 'active' : ''}" data-dashboard-op="all">전체</button>
                <button class="tabBtn ${state.dashboardOperationFilter === 'latest' ? 'active' : ''}" data-dashboard-op="latest">최신</button>
                <button class="tabBtn ${state.dashboardOperationFilter === 'reconcile' ? 'active' : ''}" data-dashboard-op="reconcile">보정</button>
              </div>
              <select id="dashboardSort" style="min-width:140px">
                <option value="newest" ${state.dashboardSort === 'newest' ? 'selected' : ''}>최신순</option>
                <option value="oldest" ${state.dashboardSort === 'oldest' ? 'selected' : ''}>오래된순</option>
                <option value="name" ${state.dashboardSort === 'name' ? 'selected' : ''}>이름순</option>
              </select>
            </div>
          </div>
          <table><thead><tr><th>Job</th><th>상태</th><th>타입</th><th>Items</th><th>Finished</th><th>이동</th></tr></thead>
          <tbody>${sorted.map((run) => `
            <tr class="${run.stale ? 'staleRow' : ''}">
              <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
              <td>${run.stale ? '<span class="pill opReconcile">주기 초과</span>' : esc(run.status || 'not run')}</td>
              <td>${operationBadge(run.operation)}<br/><span class="muted">${esc(run.resultKind || run.domain || '-')}</span></td>
              <td>${run.itemCount ?? 0}</td>
              <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
              <td>
                <button class="success" data-job-run="${esc(run.jobKey)}">실행</button>
                <button class="secondary" data-open-job="${esc(run.jobKey)}">설정</button>
                <button class="secondary" data-open-job-log="${esc(run.jobKey)}">로그</button>
              </td>
            </tr>
          `).join('')}</tbody></table>
          ${sorted.length === 0 ? '<p class="muted" style="margin-top:10px">조건에 맞는 실행 로그가 없습니다.</p>' : ''}
        `;
      }

      async function loadJobs() {
        const body = await api('/admin/api/jobs');
        state.jobs = body.data;
        if ($('jobRunJob')) {
          const current = $('jobRunJob').value;
          $('jobRunJob').innerHTML = '<option value="">전체 Job</option>' + body.data.map((job) => `
            <option value="${esc(job.jobKey)}">${esc(jobDisplayName(job))}</option>
          `).join('');
          $('jobRunJob').value = current;
        }
        const jobsAll = body.data;
        const jobsFiltered = state.operationFilter === 'all'
          ? jobsAll
          : jobsAll.filter((j) => (j.operation || 'latest') === state.operationFilter);
        const groups = new Map();
        for (const job of jobsFiltered) {
          const key = job.domain || 'other';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(job);
        }
        $('jobs').innerHTML = `
          <div class="tabs" style="margin-bottom:10px">
            <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">전체</button>
            <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">최신</button>
            <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">보정</button>
          </div>
        ` + [...groups.entries()].map(([domain, jobs]) => {
          return `
            <div class="jobGroup">
              <div class="jobGroupHead">
                <div class="jobGroupTitle">
                  <span class="jobGroupIcon">${esc(domainIcons[domain] || 'J')}</span>
                  <div>
                    <h3 style="margin:0">${jobGroupTitle(domain)}</h3>
                    <div class="muted" style="font-size:12px;margin-top:2px">최신 수집과 보정 수집을 같은 카테고리에서 관리합니다.</div>
                  </div>
                </div>
                <span class="pill">${jobs.length}개</span>
              </div>
              <div class="jobList">
                ${jobs.map((job) => `
                  <div class="card jobItem">
                    <div class="jobMain">
                      <div>
                        <div class="jobTitleLine">
                          <span class="jobName">${esc(jobDisplayName(job))}</span>
                          ${operationBadge(job.operation)}
                          <span class="pill">${job.enabled ? '활성' : '중지'}</span>
                        </div>
                        <div class="jobDescription">${esc(job.description || job.jobKey)}</div>
                      </div>
                      <div class="jobStatus">
                        <span class="pill">${esc(job.provider)}</span>
                        <span class="pill">${jobIntervalLabel(job.intervalSeconds)}</span>
                        <span class="pill">Last ${formatDateTime(job.lastRunAt)}</span>
                      </div>
                      <div class="jobActions">
                        <button data-job-run="${esc(job.jobKey)}" class="success">Run</button>
                      </div>
                    </div>
                    <details class="jobSettings">
                      <summary>설정 편집 · ${esc(job.jobKey)}</summary>
                      <div class="jobSettingsBody">
                        <label>표시 이름 <input data-job-name="${esc(job.jobKey)}" value="${esc(jobDisplayName(job))}" placeholder="표시 이름" /></label>
                        <label>설명 <input data-job-desc="${esc(job.jobKey)}" value="${esc(job.description || '')}" placeholder="설명" /></label>
                        <label>주기(초) <input data-job-interval="${esc(job.jobKey)}" value="${esc(job.intervalSeconds)}" /></label>
                        <label>활성화 <span><input type="checkbox" data-job-enabled="${esc(job.jobKey)}" ${job.enabled ? 'checked' : ''}/> enabled</span></label>
                        <label>Provider <input class="readonlyInput" value="${esc(job.provider)}" disabled /></label>
                        <label>Handler <input class="readonlyInput" value="${esc(job.handler)}" disabled /></label>
                        <label>Operation <input class="readonlyInput" value="${esc(job.operation || 'latest')}" disabled /></label>
                        <button data-job-save="${esc(job.jobKey)}" class="success">Save</button>
                      </div>
                    </details>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('');
      }

      function jobRunsQueryParams() {
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
        return params.toString();
      }

      function renderJobRunsPager(targetId) {
        $(targetId).innerHTML = `
          <div class="muted">총 ${state.jobRunsTotal}개 · ${state.jobRunsPage} / ${state.jobRunsTotalPages} 페이지</div>
          <div class="row">
            <button class="secondary" data-job-runs-page="prev">이전</button>
            <button class="secondary" data-job-runs-page="next">다음</button>
          </div>
        `;
      }

      function formatDuration(ms) {
        if (!Number.isFinite(Number(ms))) return '-';
        if (Number(ms) < 1000) return `${Number(ms)}ms`;
        return `${(Number(ms) / 1000).toFixed(1)}s`;
      }

      async function loadJobRuns() {
        const body = await api(`/admin/api/job-runs?${jobRunsQueryParams()}`);
        state.jobRunsPage = body.page;
        state.jobRunsTotalPages = body.totalPages;
        state.jobRunsTotal = body.total;
        renderJobRunsPager('jobRunsPagerTop');
        renderJobRunsPager('jobRunsPagerBottom');
        $('jobRuns').innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Job</th><th>Status</th><th>Type</th><th>Trigger</th><th>Progress</th><th>Items</th><th>Duration</th><th>Started</th><th>Finished</th><th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${body.data.map((run) => `
                <tr>
                  <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                  <td><span class="pill">${esc(run.status)}</span></td>
                  <td>
                    ${operationBadge(run.operation)}
                    <br/><span class="muted">${esc(run.resultKind || run.domain || '-')} · ${esc(run.provider || '-')}</span>
                  </td>
                  <td>${esc(run.trigger || '-')}</td>
                  <td class="muted">${run.status === 'running' && Number.isFinite(Number(run.progressPercent)) ? `${Number(run.progressPercent)}%` : '-'}</td>
                  <td>${run.itemCount ?? 0}</td>
                  <td>${formatDuration(run.durationMs)}</td>
                  <td class="muted">${formatDateTime(run.startedAt)}</td>
                  <td class="muted">${formatDateTime(run.finishedAt)}</td>
                  <td class="${run.errorMessage ? 'error' : 'muted'}">${esc(run.errorMessage || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        if (body.data.length === 0) $('jobRuns').innerHTML = '<p class="muted">검색 조건에 맞는 실행 로그가 없습니다.</p>';
      }

      async function loadUiModelPresets() {
        const body = await api('/admin/api/ui-model-presets');
        state.uiModelPresets = body.data || null;
        renderUiModelPresetsEditor();
      }

      function presetsTextareaValue(key) {
        const list = state.uiModelPresets && Array.isArray(state.uiModelPresets[key]) ? state.uiModelPresets[key] : [];
        return list.join('\n');
      }

      function renderUiModelPresetsEditor() {
        if (!$('uiModelPresets')) return;
        $('uiModelPresets').innerHTML = `
          <div class="card">
            <strong>모델 프리셋(관리)</strong>
            <div class="muted" style="margin-top:4px">번역 테스트/모델 선택 드롭다운에 표시되는 기본 리스트입니다. (한 줄에 1개)</div>
            <div class="row" style="margin-top:10px;align-items:flex-start">
              <label class="fieldLabel" style="min-width:220px">OpenAI
                <textarea id="uiPresetOpenai" style="min-height:90px">${esc(presetsTextareaValue('openai'))}</textarea>
              </label>
              <label class="fieldLabel" style="min-width:220px">Claude
                <textarea id="uiPresetClaude" style="min-height:90px">${esc(presetsTextareaValue('claude'))}</textarea>
              </label>
              <label class="fieldLabel" style="min-width:220px">Mock
                <textarea id="uiPresetMock" style="min-height:90px">${esc(presetsTextareaValue('mock'))}</textarea>
              </label>
            </div>
            <div class="row" style="margin-top:8px">
              <button id="saveUiModelPresets" class="success">Save</button>
              <span class="muted" id="uiModelPresetsStatus"></span>
            </div>
          </div>
        `;
      }

      function parsePresetLines(value) {
        return uniq(String(value || '')
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean));
      }

      async function loadTranslationSettings() {
        const [body, providersBody, presetsBody] = await Promise.all([
          api('/admin/api/translation-settings'),
          api('/admin/api/provider-settings'),
          api('/admin/api/ui-model-presets'),
        ]);
        const rows = Array.isArray(body.data) ? body.data : [];
        const providers = Array.isArray(providersBody.data) ? providersBody.data : [];
        state.providerSettings = providers;
        state.uiModelPresets = presetsBody.data || null;
        const providerInfo = (key) => (providers || []).find((p) => p.provider === key) || {};
        const openaiInfo = providerInfo('openai');
        const claudeInfo = providerInfo('claude');
        const missingKeys = [
          !openaiInfo?.hasApiKey ? 'OpenAI' : null,
          !claudeInfo?.hasApiKey ? 'Claude' : null,
        ].filter(Boolean);
        const optionsForProvider = (provider, selected) => {
          const p = String(provider || '');
          const defaultModel = providers.find((x) => x.provider === p)?.defaultModel || '';
          const list = modelPresetsForProvider(p, defaultModel);
          const effective = list.includes(String(selected || '')) ? String(selected || '') : (defaultModel || list[0] || '');
          return renderModelOptions(list.length ? list : [''], effective);
        };
        $('translationSettings').innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between;gap:10px">
              <div>
                <strong>번역 설정 가이드</strong>
                <div class="muted" style="margin-top:4px">1) Locale별 번역 정책을 고르고 2) 번역 테스트로 확인한 뒤 3) 모델 프리셋(관리)에서 리스트를 관리하세요.</div>
                ${missingKeys.length ? `<div class="muted" style="margin-top:6px"><span class="pill opReconcile">주의</span> ${esc(missingKeys.join(', '))} API 키가 없습니다. (Provider 키관리에서 설정)</div>` : ''}
              </div>
              <div class="row">
                <button class="secondary" data-view="settings-keys">Provider 키관리</button>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="row" style="justify-content:space-between">
              <div>
                <strong>Locale별 번역 정책</strong>
                <div class="muted" style="margin-top:4px">enabled / 자동 번역 / provider / 모델을 한 줄에서 관리합니다.</div>
              </div>
            </div>
          </div>
          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>Locale</th>
                  <th>Enabled</th>
                  <th>Auto News</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((s) => `
                  <tr>
                    <td><span class="pill">${esc(s.locale)}</span></td>
                    <td><input type="checkbox" data-ts-enabled="${esc(s.locale)}" ${s.enabled ? 'checked' : ''}/></td>
                    <td><input type="checkbox" data-ts-auto="${esc(s.locale)}" ${s.autoTranslateNews ? 'checked' : ''}/></td>
                    <td>
                      <select data-ts-provider="${esc(s.locale)}">
                        <option value="mock" ${s.provider === 'mock' ? 'selected' : ''}>mock</option>
                        <option value="openai" ${s.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                        <option value="claude" ${s.provider === 'claude' ? 'selected' : ''}>Claude</option>
                      </select>
                    </td>
                    <td>
                      <select data-ts-model="${esc(s.locale)}">
                        ${optionsForProvider(s.provider, s.model)}
                      </select>
                    </td>
                    <td><button data-ts-save="${esc(s.locale)}" class="success">Save</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="card">
            <div class="row" style="justify-content:space-between">
              <div>
                <strong>번역 테스트</strong>
                <div class="muted" style="margin-top:4px">현재 프리셋/기본 모델로 즉시 테스트합니다.</div>
              </div>
            </div>
            <div class="row" style="margin-top:10px">
              <select id="translationTestProvider">
                <option value="mock">mock</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
              </select>
              <select id="translationTestModel"></select>
              <select id="translationTestLocale">
                <option value="ko">ko</option>
                <option value="ja">ja</option>
              </select>
              <button id="resetTranslationTestText" class="secondary">기본 문구</button>
              <button id="runTranslationTest">번역 테스트</button>
            </div>
            <textarea id="translationTestText" style="margin-top:10px">Signal 앱을 이용해 주셔서 감사합니다. 앞으로도 좋은 기능들을 업데이트하겠습니다.</textarea>
            <div id="translationTestResult" class="summary"></div>
          </div>
          <details class="card" style="padding:0">
            <summary style="padding:14px 16px;cursor:pointer">
              <strong>모델 프리셋(관리)</strong>
              <span class="muted" style="margin-left:8px">OpenAI/Claude 모델 리스트 추가</span>
            </summary>
            <div style="padding:12px 16px" id="uiModelPresets"></div>
          </details>
        `;

        renderUiModelPresetsEditor();
        if ($('uiModelPresetsStatus') && state.uiModelPresets?.updatedAt) {
          $('uiModelPresetsStatus').textContent = `최근 저장 · ${formatDateTime(state.uiModelPresets.updatedAt)}`;
        }
        if (state.openModelPresetsOnTranslations) {
          const details = document.querySelector('#translationSettings details');
          if (details instanceof HTMLDetailsElement) {
            details.open = true;
            details.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          state.openModelPresetsOnTranslations = false;
        }

        // initialize model presets (provider → model list)
        refreshTranslationTestModels(providers);
        if ($('translationTestProvider')) {
          $('translationTestProvider').addEventListener('change', () => refreshTranslationTestModels(providers));
        }
      }

      async function loadProviderSettings() {
        const body = await api('/admin/api/provider-settings');
        const rows = Array.isArray(body.data) ? body.data : [];
        state.providerSettings = rows;
        const llm = rows.filter((r) => r.provider === 'openai' || r.provider === 'claude');
        const data = rows.filter((r) => !(r.provider === 'openai' || r.provider === 'claude'));
        const renderRow = (s, { showModel }) => {
          const models = showModel ? modelPresetsForProvider(s.provider, s.defaultModel) : [];
          return `
            <tr>
              <td><strong>${esc(s.provider)}</strong></td>
              <td><span class="pill">${s.hasApiKey ? `설정됨 ${esc(s.maskedApiKey)}` : '키 없음'}</span></td>
              <td><input type="checkbox" data-provider-enabled="${esc(s.provider)}" ${s.enabled ? 'checked' : ''}/></td>
              <td>
                ${showModel ? `
                  <select data-provider-model="${esc(s.provider)}">
                    <option value="">모델 선택</option>
                    ${renderModelOptions(models, s.defaultModel || '')}
                  </select>
                ` : '<span class="muted">-</span>'}
              </td>
              <td><input class="keyInput" data-provider-key="${esc(s.provider)}" type="password" placeholder="새 API key 입력 시 교체" /></td>
              <td class="row">
                <button data-provider-save="${esc(s.provider)}" class="success">Save</button>
                <button data-provider-clear="${esc(s.provider)}" class="danger">키 삭제</button>
              </td>
            </tr>
          `;
        };
        $('providerSettings').innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between;gap:10px">
              <div>
                <strong>Provider 키관리</strong>
                <div class="muted" style="margin-top:4px">API Key / enabled / 기본 모델(defaultModel)을 관리합니다.</div>
              </div>
              <div class="row">
                <button class="secondary" data-open-model-presets="true">모델 프리셋 관리</button>
              </div>
            </div>
          </div>
          <div class="card">
            <strong>LLM (모델 + 키)</strong>
            <div class="muted" style="margin-top:4px">OpenAI/Claude는 모델 선택과 키를 함께 관리합니다.</div>
          </div>
          <div class="card">
            <table class="settingsTable">
              <thead><tr><th>Provider</th><th>Status</th><th>Enabled</th><th>Model</th><th>API Key</th><th>Actions</th></tr></thead>
              <tbody>${llm.map((s) => renderRow(s, { showModel: true })).join('') || ''}</tbody>
            </table>
            ${llm.length === 0 ? '<p class="muted">LLM provider가 없습니다.</p>' : ''}
          </div>
          <div class="card" style="margin-top:10px">
            <strong>데이터 Provider (키)</strong>
            <div class="muted" style="margin-top:4px">Finnhub/YouTube/CoinGecko 등은 키만 필요합니다.</div>
          </div>
          <div class="card">
            <table class="settingsTable">
              <thead><tr><th>Provider</th><th>Status</th><th>Enabled</th><th>API Key</th><th>Actions</th></tr></thead>
              <tbody>
                ${data.map((s) => `
                  <tr>
                    <td><strong>${esc(s.provider)}</strong></td>
                    <td><span class="pill">${s.hasApiKey ? `설정됨 ${esc(s.maskedApiKey)}` : '키 없음'}</span></td>
                    <td><input type="checkbox" data-provider-enabled="${esc(s.provider)}" ${s.enabled ? 'checked' : ''}/></td>
                    <td><input class="keyInput" data-provider-key="${esc(s.provider)}" type="password" placeholder="새 API key 입력 시 교체" /></td>
                    <td class="row">
                      <button data-provider-save="${esc(s.provider)}" class="success">Save</button>
                      <button data-provider-clear="${esc(s.provider)}" class="danger">키 삭제</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${data.length === 0 ? '<p class="muted">데이터 provider가 없습니다.</p>' : ''}
          </div>
          <div id="uiModelPresets"></div>
        `;
      }

      async function loadMarketLists() {
        const body = await api('/admin/api/market-lists');
        state.marketLists = body.data;
        $('marketLists').innerHTML = body.data.map((list) => `
          <div class="card marketListCard">
            <div class="marketListHead">
              <div>
                <strong>${esc(list.displayName)}</strong>
                <div class="muted">${esc(list.key)} · ${list.count}개 · ${formatDateTime(list.updatedAt)}</div>
              </div>
              <button data-market-list-open="${esc(list.key)}" class="secondary">편집</button>
            </div>
            <div class="summary">${esc(list.description || '')}</div>
            <div class="symbolPreview">
              ${(list.symbols || []).slice(0, 24).map((symbol) => `<span class="pill">${esc(symbol)}</span>`).join('')}
              ${list.count > 24 ? `<span class="pill">+${list.count - 24}</span>` : ''}
            </div>
          </div>
        `).join('');
      }

      function normalizeSymbolInput(value) {
        return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
      }

      function renderMarketListDialog() {
        const draft = state.marketListDraft;
        if (!draft) {
          $('marketListDialog').classList.add('hidden');
          return;
        }
        $('marketListDialog').classList.remove('hidden');
        $('marketListDialogTitle').textContent = `${draft.displayName} 편집`;
        $('marketListDialogMeta').textContent = `${draft.key} · 마지막 수정 ${formatDateTime(draft.updatedAt)}`;
        $('marketListDialogName').value = draft.displayName;
        $('marketListDialogDesc').value = draft.description || '';
        $('marketListDialogCount').textContent = `총 ${draft.symbols.length}개`;
        $('marketListSymbolRows').innerHTML = draft.symbols.map((symbol, index) => `
          <div class="symbolRow">
            <span class="muted">${index + 1}</span>
            <input data-market-symbol-index="${index}" value="${esc(symbol)}" />
            <button class="danger" data-market-symbol-delete="${index}">삭제</button>
          </div>
        `).join('') || '<p class="muted">아직 종목이 없습니다. 위 입력창에서 추가하세요.</p>';
      }

      function openMarketListDialog(key) {
        const list = state.marketLists.find((item) => item.key === key);
        if (!list) return;
        state.marketListDraft = {
          ...list,
          symbols: [...(list.symbols || [])],
        };
        $('marketListAddSymbol').value = '';
        renderMarketListDialog();
      }

      function closeMarketListDialog() {
        state.marketListDraft = null;
        renderMarketListDialog();
      }

      function syncMarketListDraftFromInputs() {
        if (!state.marketListDraft) return;
        state.marketListDraft.displayName = $('marketListDialogName').value.trim() || state.marketListDraft.key;
        state.marketListDraft.description = $('marketListDialogDesc').value.trim();
        state.marketListDraft.symbols = [...document.querySelectorAll('[data-market-symbol-index]')]
          .map((input) => normalizeSymbolInput(input.value))
          .filter(Boolean);
      }

      function newsQueryParams() {
        const params = new URLSearchParams({
          locale: $('newsLocale').value,
          page: String(state.newsPage),
          pageSize: $('newsPageSize').value,
        });
        for (const [key, id] of [
          ['q', 'newsQuery'],
          ['from', 'newsFrom'],
          ['to', 'newsTo'],
          ['category', 'newsCategory'],
          ['translationStatus', 'newsTranslationStatus'],
        ]) {
          const value = $(id).value.trim();
          if (value) params.set(key, value);
        }
        return params.toString();
      }

      function renderPager(targetId) {
        $(targetId).innerHTML = `
          <div class="muted">총 ${state.newsTotal}개 · ${state.newsPage} / ${state.newsTotalPages} 페이지</div>
          <div class="row">
            <button class="secondary" data-page="prev">이전</button>
            <button class="secondary" data-page="next">다음</button>
          </div>
        `;
      }

      function youtubeQueryParams() {
        const params = new URLSearchParams({
          page: String(state.youtubePage),
          pageSize: $('youtubePageSize').value,
        });
        for (const [key, id] of [['q', 'youtubeQuery'], ['channel', 'youtubeChannel']]) {
          const value = $(id).value.trim();
          if (value) params.set(key, value);
        }
        return params.toString();
      }

      function renderYoutubePager(targetId) {
        $(targetId).innerHTML = `
          <div class="muted">총 ${state.youtubeTotal}개 · ${state.youtubePage} / ${state.youtubeTotalPages} 페이지</div>
          <div class="row">
            <button class="secondary" data-youtube-page="prev">이전</button>
            <button class="secondary" data-youtube-page="next">다음</button>
          </div>
        `;
      }

      function calendarQueryParams() {
        const params = new URLSearchParams({
          page: String(state.calendarPage || 1),
          pageSize: $('calendarPageSize')?.value || '30',
        });
        for (const [key, id] of [
          ['q', 'calendarQuery'],
          ['from', 'calendarFrom'],
          ['to', 'calendarTo'],
          ['type', 'calendarType'],
        ]) {
          const el = $(id);
          const value = el ? el.value.trim() : '';
          if (value) params.set(key, value);
        }
        return params.toString();
      }

      function renderCalendarPager(targetId) {
        if (!$(targetId)) return;
        $(targetId).innerHTML = `
          <div class="muted">총 ${state.calendarTotal || 0}개 · ${state.calendarPage || 1} / ${state.calendarTotalPages || 1} 페이지</div>
          <div class="row">
            <button class="secondary" data-calendar-page="prev">이전</button>
            <button class="secondary" data-calendar-page="next">다음</button>
          </div>
        `;
      }

      async function loadCalendar() {
        if (!$('calendar')) return;
        const body = await api(`/admin/api/calendar?${calendarQueryParams()}`);
        state.calendarPage = body.page;
        state.calendarTotalPages = body.totalPages;
        state.calendarTotal = body.total;
        renderCalendarPager('calendarPagerTop');
        renderCalendarPager('calendarPagerBottom');
        $('calendar').innerHTML = body.data.length === 0
          ? '<p class="muted">검색 조건에 맞는 캘린더 이벤트가 없습니다.</p>'
          : `
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Title</th><th>Meta</th></tr>
                </thead>
                <tbody>
                  ${body.data.map((item) => `
                    <tr>
                      <td class="muted">${esc(item.date || '-')}</td>
                      <td><span class="pill">${esc(item.type || '-')}</span></td>
                      <td><strong>${esc(item.title || '-')}</strong></td>
                      <td class="muted">${esc(item.country || item.symbol || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
      }

      async function loadYoutube() {
        const body = await api(`/admin/api/youtube?${youtubeQueryParams()}`);
        state.youtubePage = body.page;
        state.youtubeTotalPages = body.totalPages;
        state.youtubeTotal = body.total;
        if (Array.isArray(body.channels)) {
          const current = $('youtubeChannel').value;
          $('youtubeChannel').innerHTML = '<option value="">전체 채널</option>' + body.channels.map((channel) => `
            <option value="${esc(channel)}">${esc(channel)}</option>
          `).join('');
          $('youtubeChannel').value = current;
        }
        renderYoutubePager('youtubePagerTop');
        renderYoutubePager('youtubePagerBottom');
        $('youtube').innerHTML = body.data.map((item) => `
          <div class="card">
            <div class="mediaCard">
              <img class="thumb" src="${esc(item.thumbnailUrl || '')}" alt="" />
              <div>
                <div class="row">
                  <input type="checkbox" data-youtube-id="${esc(item.id)}" />
                  <span class="pill">${esc(item.channel || '-')}</span>
                  <span class="pill">${Number(item.viewCount || 0).toLocaleString()} views</span>
                  <span class="muted">${formatDateTime(item.publishedAt)}</span>
                </div>
                <div class="title">${esc(item.title || '-')}</div>
                <div class="summary">${esc(item.description || '')}</div>
                <div class="row" style="margin-top:8px">
                  <a class="developerLink" style="margin:0;padding:0;border:0" href="https://www.youtube.com/watch?v=${esc(item.videoId)}" target="_blank" rel="noreferrer">YouTube 열기 ↗</a>
                </div>
              </div>
            </div>
          </div>
        `).join('') || '<p class="muted">검색 조건에 맞는 영상이 없습니다.</p>';
        updateYoutubeSelectionInfo();
      }

      async function loadNews() {
        const body = await api(`/admin/api/news?${newsQueryParams()}`);
        state.newsPage = body.page;
        state.newsTotalPages = body.totalPages;
        state.newsTotal = body.total;
        renderPager('newsPagerTop');
        renderPager('newsPagerBottom');
        $('news').innerHTML = body.data.map((item) => {
          const locale = $('newsLocale').value;
          const translation = item.translations.find((t) => t.locale === locale) || {};
          return `
            <div class="card">
              <div class="row">
                <input type="checkbox" data-news-id="${esc(item.id)}" />
                <span class="pill">${item.translationStatus}</span>
                <span class="pill">${item.category || '-'}</span>
                <span class="pill">${item.provider}</span>
                <span class="muted">${formatDateTime(item.publishedAt)}</span>
              </div>
              <div class="title">${esc(item.originalTitle || '-')}</div>
              <div class="summary">${esc(item.originalSummary || '')}</div>
              <p class="muted">번역 (${locale})</p>
              <textarea data-title="${esc(item.id)}">${esc(translation.title || item.title || '')}</textarea>
              <textarea data-summary="${esc(item.id)}">${esc(translation.summary || item.summary || '')}</textarea>
              <div class="row"><button data-save-translation="${item.id}" class="secondary">수동 저장</button></div>
            </div>
          `;
        }).join('') || '<p class="muted">검색 조건에 맞는 뉴스가 없습니다.</p>';
        updateNewsSelectionInfo();
      }

      function selectedNewsIds() {
        return [...document.querySelectorAll('[data-news-id]')].filter((box) => box.checked).map((box) => box.dataset.newsId);
      }

      function updateNewsSelectionInfo() {
        const total = document.querySelectorAll('[data-news-id]').length;
        const selected = selectedNewsIds().length;
        if ($('newsSelectionInfo')) $('newsSelectionInfo').textContent = `선택된 뉴스 ${selected}개`;
        if ($('selectPageBtn')) $('selectPageBtn').textContent = selected === total && total > 0 ? '현재 페이지 선택 해제' : '현재 페이지 선택';
        if ($('retranslateSelectedBtn')) $('retranslateSelectedBtn').disabled = selected === 0;
        if ($('deleteSelectedNewsBtn')) $('deleteSelectedNewsBtn').disabled = selected === 0;
      }

      function selectedYoutubeIds() {
        return [...document.querySelectorAll('[data-youtube-id]')].filter((box) => box.checked).map((box) => box.dataset.youtubeId);
      }

      function updateYoutubeSelectionInfo() {
        const total = document.querySelectorAll('[data-youtube-id]').length;
        const selected = selectedYoutubeIds().length;
        if ($('youtubeSelectionInfo')) $('youtubeSelectionInfo').textContent = `선택된 영상 ${selected}개`;
        if ($('selectYoutubePageBtn')) $('selectYoutubePageBtn').textContent = selected === total && total > 0 ? '현재 페이지 선택 해제' : '현재 페이지 선택';
        if ($('refreshSelectedYoutubeBtn')) $('refreshSelectedYoutubeBtn').disabled = selected === 0;
      }

      document.addEventListener('click', async (event) => {
        const target = event.target;
        try {
          if (target.dataset && target.dataset.comingSoon === 'true') {
            showToast('준비중', '해당 메뉴는 아직 구현되지 않았습니다.');
            return;
          }
          if (target.dataset.openModelPresets) {
            state.openModelPresetsOnTranslations = true;
            await switchView('translations');
            return;
          }
          if (target.dataset.dashboardOp) {
            state.dashboardOperationFilter = target.dataset.dashboardOp || 'all';
            await loadDashboard();
            return;
          }
          if (target.dataset.view) await switchView(target.dataset.view);
          if (target.dataset.jobTab) setJobTab(target.dataset.jobTab);
          if (target.dataset.settingsTab) setSettingsTab(target.dataset.settingsTab);
          if (target.dataset.opFilter) {
            state.operationFilter = target.dataset.opFilter;
            await Promise.all([loadMonitoring(), loadJobs(), loadErrors()]);
          }
          if (target.dataset.newsLocale) {
            $('newsLocale').value = target.dataset.newsLocale;
            document.querySelectorAll('[data-news-locale]').forEach((btn) => btn.classList.toggle('active', btn.dataset.newsLocale === target.dataset.newsLocale));
            state.newsPage = 1;
            await loadNews();
          }
          if (target.dataset.theme) applyTheme(target.dataset.theme);
          if (target.dataset.openJob) {
            await switchView('jobs');
            setJobTab('info');
            setTimeout(() => document.querySelector(`[data-job-name="${target.dataset.openJob}"]`)?.closest('.jobItem')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
          }
          if (target.dataset.openJobLog) {
            await switchView('jobs');
            setJobTab('runs');
            $('jobRunJob').value = target.dataset.openJobLog;
            state.jobRunsPage = 1;
            await loadJobRuns();
          }
          if (target.id === 'loginBtn') {
            await api('/admin/api/login', { method: 'POST', body: JSON.stringify({ loginId: $('loginId').value, password: $('password').value }) });
            $('loginMsg').textContent = '';
            await refreshSession();
          }
          if (target.id === 'logoutBtn') {
            await api('/admin/api/logout', { method: 'POST' });
            await refreshSession();
          }
          if (target.dataset.jobSave) {
            const key = target.dataset.jobSave;
            await api(`/admin/api/jobs/${encodeURIComponent(key)}`, {
              method: 'PATCH',
              body: JSON.stringify({
                enabled: document.querySelector(`[data-job-enabled="${key}"]`).checked,
                displayName: document.querySelector(`[data-job-name="${key}"]`).value,
                description: document.querySelector(`[data-job-desc="${key}"]`).value,
                intervalSeconds: Number(document.querySelector(`[data-job-interval="${key}"]`).value),
              }),
            });
            await Promise.all([loadJobs(), loadDashboard()]);
          }
          if (target.dataset.jobRun) {
            await api(`/admin/api/jobs/${encodeURIComponent(target.dataset.jobRun)}/run`, { method: 'POST' });
            await Promise.all([loadJobs(), loadJobRuns(), loadDashboard(), loadNews(), loadYoutube()]);
          }
          if (target.dataset.tsSave) {
            const locale = target.dataset.tsSave;
            await api(`/admin/api/translation-settings/${locale}`, {
              method: 'PATCH',
              body: JSON.stringify({
                enabled: document.querySelector(`[data-ts-enabled="${locale}"]`).checked,
                autoTranslateNews: document.querySelector(`[data-ts-auto="${locale}"]`).checked,
                provider: document.querySelector(`[data-ts-provider="${locale}"]`).value,
                model: document.querySelector(`[data-ts-model="${locale}"]`).value,
              }),
            });
            await loadTranslationSettings();
          }
          if (target.dataset.providerSave) {
            const provider = target.dataset.providerSave;
            const apiKey = document.querySelector(`[data-provider-key="${provider}"]`).value.trim();
            await api(`/admin/api/provider-settings/${provider}`, {
              method: 'PATCH',
              body: JSON.stringify({
                enabled: document.querySelector(`[data-provider-enabled="${provider}"]`).checked,
                defaultModel: document.querySelector(`[data-provider-model="${provider}"]`).value.trim(),
                apiKey,
              }),
            });
            await loadProviderSettings();
          }
          if (target.dataset.providerClear) {
            const provider = target.dataset.providerClear;
            if (!confirm(`${provider} API key를 삭제할까요?`)) return;
            await api(`/admin/api/provider-settings/${provider}`, {
              method: 'PATCH',
              body: JSON.stringify({ clearApiKey: true }),
            });
            await loadProviderSettings();
          }
          if (target.id === 'saveUiModelPresets') {
            const next = {
              openai: parsePresetLines($('uiPresetOpenai')?.value),
              claude: parsePresetLines($('uiPresetClaude')?.value),
              mock: parsePresetLines($('uiPresetMock')?.value),
            };
            const result = await api('/admin/api/ui-model-presets', { method: 'PATCH', body: JSON.stringify(next) });
            state.uiModelPresets = result.data || null;
            if ($('uiModelPresetsStatus')) $('uiModelPresetsStatus').textContent = `저장됨 · ${formatDateTime(state.uiModelPresets?.updatedAt)}`;
            showToast('저장 완료', '모델 프리셋이 업데이트되었습니다.');
            await loadTranslationSettings();
          }
          if (target.dataset.marketListOpen) {
            openMarketListDialog(target.dataset.marketListOpen);
          }
          if (target.id === 'closeMarketListDialog' || target.id === 'cancelMarketListDialog') {
            closeMarketListDialog();
          }
          if (target.id === 'marketListDialog') {
            closeMarketListDialog();
          }
          if (target.id === 'addMarketListSymbol') {
            syncMarketListDraftFromInputs();
            const symbols = String($('marketListAddSymbol').value || '')
              .split(/[\s,]+/)
              .map(normalizeSymbolInput)
              .filter(Boolean);
            if (state.marketListDraft) {
              for (const symbol of symbols) {
                if (!state.marketListDraft.symbols.includes(symbol)) state.marketListDraft.symbols.push(symbol);
              }
            }
            $('marketListAddSymbol').value = '';
            renderMarketListDialog();
          }
          if (target.dataset.marketSymbolDelete) {
            syncMarketListDraftFromInputs();
            const index = Number(target.dataset.marketSymbolDelete);
            if (state.marketListDraft && Number.isInteger(index)) {
              state.marketListDraft.symbols.splice(index, 1);
              renderMarketListDialog();
            }
          }
          if (target.id === 'saveMarketListDialog') {
            syncMarketListDraftFromInputs();
            const draft = state.marketListDraft;
            if (!draft) return;
            const key = draft.key;
            await api(`/admin/api/market-lists/${encodeURIComponent(key)}`, {
              method: 'PATCH',
              body: JSON.stringify({
                displayName: draft.displayName,
                description: draft.description,
                symbols: draft.symbols,
              }),
            });
            closeMarketListDialog();
            await Promise.all([loadMarketLists(), loadDashboard()]);
          }
          if (target.dataset.saveTranslation) {
            const id = target.dataset.saveTranslation;
            const locale = $('newsLocale').value;
            await api(`/admin/api/news/${encodeURIComponent(id)}/translation/${locale}`, {
              method: 'PATCH',
              body: JSON.stringify({
                title: document.querySelector(`[data-title="${id}"]`).value,
                summary: document.querySelector(`[data-summary="${id}"]`).value,
              }),
            });
            await loadNews();
          }
          if (target.id === 'loadNewsBtn') {
            state.newsPage = 1;
            await loadNews();
          }
          if (target.id === 'loadJobRunsBtn') {
            state.jobRunsPage = 1;
            await loadJobRuns();
          }
          if (target.dataset.jobRunsPage === 'prev' && state.jobRunsPage > 1) {
            state.jobRunsPage -= 1;
            await loadJobRuns();
          }
          if (target.dataset.jobRunsPage === 'next' && state.jobRunsPage < state.jobRunsTotalPages) {
            state.jobRunsPage += 1;
            await loadJobRuns();
          }
          if (target.id === 'loadYoutubeBtn') {
            state.youtubePage = 1;
            await loadYoutube();
          }
          if (target.id === 'loadCalendarBtn') {
            state.calendarPage = 1;
            await loadCalendar();
          }
          if (target.dataset.youtubePage === 'prev' && state.youtubePage > 1) {
            state.youtubePage -= 1;
            await loadYoutube();
          }
          if (target.dataset.youtubePage === 'next' && state.youtubePage < state.youtubeTotalPages) {
            state.youtubePage += 1;
            await loadYoutube();
          }
          if (target.dataset.calendarPage === 'prev' && state.calendarPage > 1) {
            state.calendarPage -= 1;
            await loadCalendar();
          }
          if (target.dataset.calendarPage === 'next' && state.calendarPage < state.calendarTotalPages) {
            state.calendarPage += 1;
            await loadCalendar();
          }
          if (target.id === 'selectPageBtn') {
            const boxes = [...document.querySelectorAll('[data-news-id]')];
            const allSelected = boxes.length > 0 && boxes.every((box) => box.checked);
            boxes.forEach((box) => { box.checked = !allSelected; });
            updateNewsSelectionInfo();
          }
          if (target.id === 'selectYoutubePageBtn') {
            const boxes = [...document.querySelectorAll('[data-youtube-id]')];
            const allSelected = boxes.length > 0 && boxes.every((box) => box.checked);
            boxes.forEach((box) => { box.checked = !allSelected; });
            updateYoutubeSelectionInfo();
          }
          if (target.id === 'retranslateSelectedBtn') {
            const ids = selectedNewsIds();
            await api('/admin/api/news/retranslate', { method: 'POST', body: JSON.stringify({ ids, locale: $('newsLocale').value }) });
            await loadNews();
          }
          if (target.id === 'deleteSelectedNewsBtn') {
            const ids = selectedNewsIds();
            if (ids.length === 0) return;
            if (!confirm(`선택한 뉴스 ${ids.length}개를 삭제할까요?`)) return;
            await api('/admin/api/news/delete', { method: 'POST', body: JSON.stringify({ ids }) });
            await Promise.all([loadNews(), loadDashboard()]);
          }
          if (target.id === 'refreshSelectedYoutubeBtn') {
            const ids = selectedYoutubeIds();
            await api('/admin/api/youtube/refresh-selected', { method: 'POST', body: JSON.stringify({ ids }) });
            await Promise.all([loadYoutube(), loadJobRuns(), loadDashboard()]);
          }
          if (target.id === 'resetTranslationTestText') {
            $('translationTestText').value = 'Signal 앱을 이용해 주셔서 감사합니다. 앞으로도 좋은 기능들을 업데이트하겠습니다.';
          }
          if (target.id === 'runTranslationTest') {
            const result = await api('/admin/api/translation-test', {
              method: 'POST',
              body: JSON.stringify({
                locale: $('translationTestLocale').value,
                provider: $('translationTestProvider').value,
                model: $('translationTestModel').value,
                text: $('translationTestText').value,
              }),
            });
            $('translationTestResult').innerHTML = `<strong>${esc(result.data.title || '')}</strong><br/>${esc(result.data.summary || '')}`;
          }
          if (target.id === 'resetDataBtn') {
            const targets = [...document.querySelectorAll('[data-reset-target]')]
              .filter((box) => box.checked)
              .map((box) => box.dataset.resetTarget);
            const body = {
              targets,
              confirmText: $('resetConfirmText').value.trim(),
            };
            const result = await api('/admin/api/data-reset', { method: 'POST', body: JSON.stringify(body) });
            $('resetResult').textContent = `초기화 완료: ${result.data.targets.join(', ')}`;
            $('resetConfirmText').value = '';
            document.querySelectorAll('[data-reset-target]').forEach((box) => { box.checked = false; });
            await Promise.all([loadDashboard(), loadJobs(), loadJobRuns(), loadNews(), loadYoutube()]);
          }
          if (target.dataset.page === 'prev' && state.newsPage > 1) {
            state.newsPage -= 1;
            await loadNews();
          }
          if (target.dataset.page === 'next' && state.newsPage < state.newsTotalPages) {
            state.newsPage += 1;
            await loadNews();
          }
        } catch (error) {
          alert(error.message);
        }
      });

      document.addEventListener('change', async (event) => {
        // Provider changed in translation settings table → refresh model list for that locale row.
        if (event.target instanceof HTMLSelectElement && event.target.dataset.tsProvider) {
          const locale = event.target.dataset.tsProvider;
          const provider = event.target.value || 'mock';
          const defaultModel = (state.providerSettings || []).find((p) => p.provider === provider)?.defaultModel || '';
          const list = modelPresetsForProvider(provider, defaultModel);
          const modelSelect = document.querySelector(`[data-ts-model="${locale}"]`);
          if (modelSelect instanceof HTMLSelectElement) {
            const current = modelSelect.value || '';
            const nextValue = list.includes(current) ? current : (defaultModel || list[0] || '');
            modelSelect.innerHTML = renderModelOptions(list.length ? list : [''], nextValue);
          }
        }
        if (event.target.id === 'adminLanguage') {
          localStorage.setItem('signalAdminLanguage', event.target.value);
          applyAdminLanguage();
        }
        if (event.target.id === 'adminTimeBasis') {
          localStorage.setItem('signalAdminTimeBasis', event.target.value);
          await Promise.all([loadDashboard(), loadJobs(), loadJobRuns(), loadNews(), loadYoutube()]);
        }
        if (event.target.id === 'newsRange') {
          setDatePreset();
          state.newsPage = 1;
          await loadNews();
        }
        if (event.target.id === 'dashboardSort') {
          state.dashboardSort = event.target.value || 'newest';
          await loadDashboard();
        }
        if (event.target.id === 'jobRunRange') {
          setJobRunDatePreset();
          state.jobRunsPage = 1;
          await loadJobRuns();
        }
        if (event.target.id === 'jobRunJob') {
          state.jobRunsPage = 1;
          await loadJobRuns();
        }
        if (event.target.id === 'marketListAddSymbol' && event.target.value.includes(',')) {
          event.target.value = event.target.value.replaceAll(',', ' ');
        }
        if (event.target.dataset.newsId) updateNewsSelectionInfo();
        if (event.target.dataset.youtubeId) updateYoutubeSelectionInfo();
      });

      document.addEventListener('keydown', async (event) => {
        if (event.key === 'Escape' && state.marketListDraft) {
          closeMarketListDialog();
        }
        if (event.key === 'Enter' && event.target.id === 'marketListAddSymbol') {
          event.preventDefault();
          document.getElementById('addMarketListSymbol')?.click();
        }
      });

      applyTheme(localStorage.getItem('signalAdminAccent') || 'green');
      $('adminLanguage').value = localStorage.getItem('signalAdminLanguage') || 'ko';
      $('adminTimeBasis').value =
        localStorage.getItem('signalAdminTimeBasis') ||
        (localStorage.getItem('signalAdminTimeMode') === 'utc'
          ? 'utc|UTC'
          : `${localStorage.getItem('signalAdminLocale') || 'ko-KR'}|${localStorage.getItem('signalAdminLocale') === 'en-US' ? 'America/New_York' : localStorage.getItem('signalAdminLocale') === 'ja-JP' ? 'Asia/Tokyo' : 'Asia/Seoul'}`);
      applyAdminLanguage();
      refreshSession().catch((error) => { $('session').textContent = error.message; });
      // Keep settings tab stable across refreshes
      if ($('settingsTab-keys')) setSettingsTab(state.settingsTab || 'keys');
