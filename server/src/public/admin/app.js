import { api } from './api.js';
import { esc, formatDateTime, jobIntervalLabel, ymd } from './format.js';
import { applyAdminLanguage, textFor, textForVars } from './i18n.js';
import { closeConfirm, confirmState, openConfirm } from './modal.js';
import { $, state } from './state.js';
import { applyTheme } from './theme.js';
import { dismissToast, showToast } from './toast.js';

      function jobRunRowSelectKey(run) {
        const id = String(run?.id || '').trim();
        if (id) return id;
        // Back-compat for very old local DB rows (should be rare)
        return `${String(run?.jobKey || '').trim()}:${String(run?.startedAt || '').trim()}:${String(run?.finishedAt || '').trim()}`;
      }

      function jobKeysForSelectedJobRuns(rows, selectedKeys) {
        const selected = new Set(selectedKeys || []);
        const keys = [];
        for (const run of rows || []) {
          const k = jobRunRowSelectKey(run);
          if (!selected.has(k)) continue;
          const jobKey = String(run?.jobKey || '').trim();
          if (!jobKey) continue;
          if (!keys.includes(jobKey)) keys.push(jobKey);
        }
        return keys;
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

      function renderTableSkeleton({ cols = 6, rows = 5 } = {}) {
        const c = Math.max(1, Number(cols) || 6);
        const r = Math.max(1, Number(rows) || 5);
        return `
          <table>
            <tbody>
              ${Array.from({ length: r }).map(() => `
                <tr class="skeletonRow">
                  ${Array.from({ length: c }).map(() => `<td><div class="skeletonBar"></div></td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
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
        const rangeEl = $(`${prefix}Range`);
        if (!rangeEl) return;
        const preset = rangeEl.value;
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

      function domainLabel(domain) {
        const d = domain || 'other';
        const key =
          d === 'news'
            ? 'domainNews'
            : d === 'calendar'
              ? 'domainCalendar'
              : d === 'youtube'
                ? 'domainYoutube'
                : d === 'market'
                  ? 'domainMarket'
                  : 'domainOther';
        return textFor(key);
      }

      function operationLabel(operation) {
        const op = operation || 'latest';
        const key = op === 'reconcile' ? 'opReconcile' : op === 'maintenance' ? 'opMaintenance' : 'opLatest';
        return textFor(key);
      }

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
        return domainLabel(domain);
      }

      function operationBadge(operation) {
        const op = operation || 'latest';
        const css = op === 'reconcile' ? 'opReconcile' : op === 'latest' ? 'opLatest' : 'opMaintenance';
        return `<span class="pill ${css}">${esc(operationLabel(op))}</span>`;
      }

      function domainBadge(domain) {
        const d = String(domain || 'other');
        const known = ['news', 'calendar', 'youtube', 'market', 'other'].includes(d);
        return `<span class="pill">${esc(known ? domainLabel(d) : d)}</span>`;
      }

      function providerBadge(provider) {
        return `<span class="pill pill--subtle">${esc(provider || '-')}</span>`;
      }

      function runStatusPill(status, stale) {
        if (stale) return `<span class="pill pillStatus pillStatus--warn">${esc(textFor('runStale'))}</span>`;
        const s = String(status || '').toLowerCase();
        let cls = 'pillStatus--muted';
        let key = 'statusUnknown';
        if (s === 'completed' || s === 'complete' || s === 'success') {
          cls = 'pillStatus--ok';
          key = 'statusCompleted';
        } else if (s === 'running') {
          cls = 'pillStatus--run';
          key = 'statusRunning';
        } else if (s === 'failed' || s === 'error') {
          cls = 'pillStatus--fail';
          key = 'statusFailed';
        } else if (!s || s === 'not run' || s === '-') {
          key = 'statusNotRun';
        }
        return `<span class="pill pillStatus ${cls}">${esc(textFor(key))}</span>`;
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
                : requestedView === 'settings-sources'
                  ? 'sources'
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
                  : settingsTabFromView === 'sources'
                    ? '뉴스 출처'
                    : settingsTabFromView === 'danger'
                      ? '데이터 초기화'
                      : 'Provider';
          }
          const desc = $('settingsDesc');
          if (desc) {
            desc.textContent =
              settingsTabFromView === 'theme'
                ? '브라우저에 저장되는 UI 테마를 설정합니다.'
                : settingsTabFromView === 'lists'
                  ? '앱과 수집 Job이 공통으로 사용하는 마켓 리스트를 관리합니다.'
                  : settingsTabFromView === 'sources'
                    ? '앱 뉴스 필터에 노출되는 출처와 별칭을 관리합니다.'
                    : settingsTabFromView === 'danger'
                      ? '외부 API에서 가져온 로컬 저장 데이터를 선택적으로 초기화합니다.'
                      : '외부 Provider(API Key)와 LLM 기본 모델(defaultModel)을 관리합니다.';
          }
        }
        if (resolvedView === 'jobs') {
          setJobTab(state.jobTab || 'info');
        }
      }

      function setJobTab(tab) {
        state.jobTab = tab;
        document.querySelectorAll('[data-job-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.jobTab === tab));
        $('jobs').classList.toggle('hidden', tab !== 'info');
        $('jobRunsPanel').classList.toggle('hidden', tab !== 'runs');
        if (tab === 'runs') void loadJobRuns();
        const params = new URLSearchParams(window.location.search);
        params.set('tab', tab);
        params.set('runSort', state.jobRunsSortKey || 'finishedAt');
        params.set('runDir', state.jobRunsSortDir || 'desc');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
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
        if ($('headerProfileName')) $('headerProfileName').textContent = loggedIn ? `${body.adminId}` : 'guest';
        if ($('profileMenuTitle')) $('profileMenuTitle').textContent = loggedIn ? `${body.adminId}` : 'guest';
        document.body.classList.toggle('loginMode', !loggedIn);
        $('loginPanel').classList.toggle('hidden', loggedIn);
        $('adminPanel').classList.toggle('hidden', !loggedIn);
        $('logoutBtn').classList.toggle('hidden', !loggedIn);
        if (loggedIn) {
          // Restore job tab from URL (?tab=info|runs)
          const urlParams = new URLSearchParams(window.location.search);
          const jobTabFromUrl = urlParams.get('tab');
          if (jobTabFromUrl === 'info' || jobTabFromUrl === 'runs') state.jobTab = jobTabFromUrl;
          const runSort = urlParams.get('runSort');
          const runDir = urlParams.get('runDir');
          if (runSort) state.jobRunsSortKey = runSort;
          if (runDir === 'asc' || runDir === 'desc') state.jobRunsSortDir = runDir;
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
            loadNewsSourceSettings(),
            loadNewsSources(),
            loadNews(),
            loadCalendar(),
            loadYoutube(),
          ]);
        }
      }

      function openPanel(id) { $(id)?.classList.remove('hidden'); }
      function closePanel(id) { $(id)?.classList.add('hidden'); }
      function isPanelOpen(id) { return !$(id)?.classList.contains('hidden'); }

      async function refreshNotifications() {
        if (!$('headerNotifBadge')) return;
        try {
          const summary = (await api('/admin/api/summary')).data;
          const runs = Array.isArray(summary.recentRuns) ? summary.recentRuns : [];
          const failed = runs.filter((r) => String(r.status) === 'failed');
          const stale = runs.filter((r) => r.stale);
          const count = failed.length + stale.length;
          $('headerNotifBadge').textContent = String(count);
          $('headerNotifBadge').style.display = count > 0 ? '' : 'none';
          if ($('notifList')) {
            $('notifList').innerHTML = count === 0
              ? '<div class="muted">알림이 없습니다.</div>'
              : `
                ${failed.length ? `<div class="card"><strong>실패</strong><div class="muted" style="margin-top:6px">${failed.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
                ${stale.length ? `<div class="card"><strong>주기 초과</strong><div class="muted" style="margin-top:6px">${stale.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
              `;
          }
        } catch {
          $('headerNotifBadge').style.display = 'none';
        }
      }

      const searchIndex = { builtAt: 0, items: [] };
      function buildSearchIndex() {
        const items = [];
        document.querySelectorAll('[data-view]').forEach((btn) => {
          const view = btn.getAttribute('data-view');
          const label = btn.textContent?.trim();
          if (!view || !label) return;
          items.push({ kind: 'menu', label, detail: 'menu', action: () => switchView(view) });
        });
        for (const job of state.jobs || []) {
          const label = jobDisplayName(job);
          items.push({ kind: 'job', label, detail: job.jobKey, action: async () => { await switchView('jobs'); setJobTab('info'); } });
        }
        searchIndex.items = items;
        searchIndex.builtAt = Date.now();
      }

      function renderSearchResults(q) {
        const query = String(q || '').trim().toLowerCase();
        if (!query) return '<div class="muted">검색어를 입력하세요.</div>';
        const hits = (searchIndex.items || [])
          .map((it, index) => ({ it, index }))
          .filter(({ it }) => `${it.label} ${it.detail}`.toLowerCase().includes(query))
          .slice(0, 24);
        if (hits.length === 0) return '<div class="muted">검색 결과가 없습니다. 다른 키워드로 시도해보세요.</div>';
        return hits.map(({ it, index }) => `
          <button class="secondary" style="width:100%;text-align:left" data-search-hit="${index}">
            <strong>${esc(it.label)}</strong><br/>
            <span class="muted">${esc(it.detail || it.kind)}</span>
          </button>
        `).join('');
      }

      function runButton(jobKey, label) {
        const lab = label == null ? textFor('btnNowRun') : label;
        return `<button class="success" data-job-run="${esc(jobKey)}">${esc(lab)}</button>`;
      }

      async function loadMonitoring() {
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
          return state.monitoringSort === 'oldest' ? (at - bt) : (bt - at);
        });
        const stale = runs.filter((r) => r.stale);
        $('monitoring').innerHTML = `
          <div class="statGrid wideStats">
            <div class="stat"><div class="statLabel muted"><span class="statIcon">R</span>${esc(textFor('statRecentRuns'))}</div><div class="statNum">${runs.length}</div></div>
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
            <table class="settingsTable">
              <thead>
                <tr>
                  <th>${esc(textFor('colJob'))}</th>
                  <th>${esc(textFor('colStatus'))}</th>
                  <th>${esc(textFor('colOperation'))}</th>
                  <th>${esc(textFor('colDomain'))}</th>
                  <th>${esc(textFor('colProvider'))}</th>
                  <th class="right">${esc(textFor('colItems'))}</th>
                  <th>${esc(textFor('colFinished'))}</th>
                  <th class="center">${esc(textFor('colAction'))}</th>
                </tr>
              </thead>
              <tbody>
                ${runs.length === 0
                  ? `<tr><td colspan="8" class="muted">${esc(textFor('monitoringEmpty'))}</td></tr>`
                  : runs.map((run) => `
                    <tr class="${run.stale ? 'staleRow' : ''}">
                      <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                      <td>${runStatusPill(run.status, !!run.stale)}</td>
                      <td>${operationBadge(run.operation)}</td>
                      <td>${domainBadge(run.domain || run.resultKind)}</td>
                      <td>${providerBadge(run.provider)}</td>
                      <td class="right">${run.itemCount ?? 0}</td>
                      <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
                      <td class="center">
                        <div class="dataTableActions">
                          ${runButton(run.jobKey, textFor('btnNowRun'))}
                          <button class="secondary" data-open-job-log="${esc(run.jobKey)}">${esc(textFor('btnLogErrors'))}</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
            <div class="cardFoot">
              <div class="muted">${esc(textFor('tipSlowJobs'))}</div>
            </div>
          </div>
        `;
      }

      async function loadErrors() {
        if (!$('errors')) return;
        const body = await api(`/admin/api/job-runs?${new URLSearchParams({ status: 'failed', pageSize: '30', page: '1' }).toString()}`);
        const all = Array.isArray(body.data) ? body.data : [];
        const filtered = state.operationFilter === 'all' ? all : all.filter((r) => (r.operation || 'latest') === state.operationFilter);
        $('errors').innerHTML = `
          <div class="tabs" style="margin-bottom:10px">
            <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">${esc(textFor('tabAll'))}</button>
            <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">${esc(textFor('tabLatest'))}</button>
            <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">${esc(textFor('tabReconcile'))}</button>
          </div>
        ` + (filtered.length === 0
          ? `<p class="muted">${esc(textFor('errorsEmpty'))}</p>`
          : `
              <table>
                <thead>
                  <tr><th>${esc(textFor('colJob'))}</th><th>${esc(textFor('colStatus'))}</th><th>${esc(textFor('colOperation'))}</th><th>${esc(textFor('colDomain'))}</th><th>${esc(textFor('colProvider'))}</th><th>${esc(textFor('colTrigger'))}</th><th>${esc(textFor('colDuration'))}</th><th>${esc(textFor('colStarted'))}</th><th>${esc(textFor('colError'))}</th><th>${esc(textFor('colAction'))}</th></tr>
                </thead>
                <tbody>
                  ${filtered.map((run) => `
                    <tr>
                      <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                      <td>${runStatusPill(run.status, false)}</td>
                      <td>${operationBadge(run.operation)}</td>
                      <td>${domainBadge(run.domain || run.resultKind)}</td>
                      <td>${providerBadge(run.provider)}</td>
                      <td>${esc(run.trigger || '-')}</td>
                      <td>${formatDuration(run.durationMs)}</td>
                      <td class="muted">${formatDateTime(run.startedAt)}</td>
                      <td class="error">${esc(run.errorMessage || '-')}</td>
                      <td>${runButton(run.jobKey, textFor('btnRetry'))}</td>
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
            <div class="stat"><div class="statLabel muted"><span class="statIcon">N</span>${esc(textFor('statNews'))}</div><div class="statNum">${summary.counts.news}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">C</span>${esc(textFor('statCalendar'))}</div><div class="statNum">${summary.counts.calendar}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">Y</span>${esc(textFor('statYoutube'))}</div><div class="statNum">${summary.counts.youtube}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">Q</span>${esc(textFor('statQuotes'))}</div><div class="statNum">${summary.counts.marketQuotes || 0}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">B</span>${esc(textFor('statCoins'))}</div><div class="statNum">${summary.counts.coinMarkets || 0}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">J</span>${esc(textFor('statActiveJobs'))}</div><div class="statNum">${summary.counts.enabledJobs}</div></div>
          </div>
          <div class="card card--elevated" style="margin-top:12px">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('pageDashboardTitle'))}</div>
                <div class="cardHint">${esc(textFor('sectionRecentRuns'))}</div>
              </div>
              <div class="cardHeadActions">
                <div class="tabs" style="margin:0">
                  <button class="tabBtn ${state.dashboardOperationFilter === 'all' ? 'active' : ''}" data-dashboard-op="all">${esc(textFor('tabAll'))}</button>
                  <button class="tabBtn ${state.dashboardOperationFilter === 'latest' ? 'active' : ''}" data-dashboard-op="latest">${esc(textFor('tabLatest'))}</button>
                  <button class="tabBtn ${state.dashboardOperationFilter === 'reconcile' ? 'active' : ''}" data-dashboard-op="reconcile">${esc(textFor('tabReconcile'))}</button>
                </div>
                <select id="dashboardSort" style="min-width:140px">
                  <option value="newest" ${state.dashboardSort === 'newest' ? 'selected' : ''}>${esc(textFor('sortNewest'))}</option>
                  <option value="oldest" ${state.dashboardSort === 'oldest' ? 'selected' : ''}>${esc(textFor('sortOldest'))}</option>
                  <option value="name" ${state.dashboardSort === 'name' ? 'selected' : ''}>${esc(textFor('sortName'))}</option>
                </select>
              </div>
            </div>
            <table class="settingsTable">
              <thead>
                <tr>
                  <th>${esc(textFor('colJob'))}</th>
                  <th>${esc(textFor('colStatus'))}</th>
                  <th>${esc(textFor('colOperation'))}</th>
                  <th>${esc(textFor('colDomain'))}</th>
                  <th>${esc(textFor('colProvider'))}</th>
                  <th class="right">${esc(textFor('colItems'))}</th>
                  <th>${esc(textFor('colFinished'))}</th>
                  <th class="center">${esc(textFor('colAction'))}</th>
                </tr>
              </thead>
              <tbody>
                ${sorted.map((run) => `
                  <tr class="${run.stale ? 'staleRow' : ''}">
                    <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                    <td>${runStatusPill(run.status, !!run.stale)}</td>
                    <td>${operationBadge(run.operation)}</td>
                    <td>${domainBadge(run.domain || run.resultKind)}</td>
                    <td>${providerBadge(run.provider)}</td>
                    <td class="right">${run.itemCount ?? 0}</td>
                    <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
                    <td class="center">
                      <div class="dataTableActions">
                        <button class="success" data-job-run="${esc(run.jobKey)}">${esc(textFor('btnRun'))}</button>
                        <button class="secondary" data-open-job="${esc(run.jobKey)}">${esc(textFor('btnSettings'))}</button>
                        <button class="secondary" data-open-job-log="${esc(run.jobKey)}">${esc(textFor('btnLog'))}</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${sorted.length === 0 ? `<p class="muted" style="margin-top:10px">${esc(textFor('jobRunsEmpty'))}</p>` : ''}
          </div>
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
        let jobsFiltered = state.operationFilter === 'all'
          ? jobsAll
          : jobsAll.filter((j) => (j.operation || 'latest') === state.operationFilter);

        if (state.jobListEnabled === 'enabled') jobsFiltered = jobsFiltered.filter((j) => !!j.enabled);
        if (state.jobListEnabled === 'disabled') jobsFiltered = jobsFiltered.filter((j) => !j.enabled);
        if (state.jobListDomain !== 'all') jobsFiltered = jobsFiltered.filter((j) => (j.domain || 'other') === state.jobListDomain);
        if (state.jobListProvider !== 'all') jobsFiltered = jobsFiltered.filter((j) => String(j.provider || '') === state.jobListProvider);
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
            <div class="filterBarTitle filterBoxTitle">검색 조건</div>
            <div class="filterBarControls toolbar">
              <div class="tabs" style="margin:0">
                <button class="tabBtn ${state.operationFilter === 'all' ? 'active' : ''}" data-op-filter="all">전체</button>
                <button class="tabBtn ${state.operationFilter === 'latest' ? 'active' : ''}" data-op-filter="latest">최신</button>
                <button class="tabBtn ${state.operationFilter === 'reconcile' ? 'active' : ''}" data-op-filter="reconcile">보정</button>
              </div>
              <select id="jobListEnabled">
                <option value="all" ${state.jobListEnabled === 'all' ? 'selected' : ''}>전체 상태</option>
                <option value="enabled" ${state.jobListEnabled === 'enabled' ? 'selected' : ''}>활성</option>
                <option value="disabled" ${state.jobListEnabled === 'disabled' ? 'selected' : ''}>중지</option>
              </select>
              <select id="jobListDomain">
                <option value="all">전체 도메인</option>
                ${domains.map((d) => `<option value="${esc(d)}" ${state.jobListDomain === d ? 'selected' : ''}>${esc(jobGroupTitle(d))}</option>`).join('')}
              </select>
              <select id="jobListProvider">
                <option value="all">전체 Provider</option>
                ${providers.map((p) => `<option value="${esc(p)}" ${state.jobListProvider === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
              </select>
              <input id="jobListQuery" class="wide" placeholder="키워드: 이름, jobKey, 설명, provider" value="${esc(state.jobListQuery)}" />
              <select id="jobListSort">
                <option value="name" ${state.jobListSort === 'name' ? 'selected' : ''}>이름순</option>
                <option value="lastRunDesc" ${state.jobListSort === 'lastRunDesc' ? 'selected' : ''}>최근 실행순</option>
                <option value="intervalAsc" ${state.jobListSort === 'intervalAsc' ? 'selected' : ''}>주기 짧은순</option>
              </select>
              <button class="secondary" id="jobListReset">초기화</button>
            </div>
          </div>
          <div class="card">
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
                ${jobsFiltered.map((job) => `
                  <tr>
                    <td>
                      <strong>${esc(jobDisplayName(job))}</strong><br/>
                      <span class="muted">${esc(job.jobKey)}</span>
                      ${job.description ? `<div class="muted" style="margin-top:4px">${esc(job.description)}</div>` : ''}
                    </td>
                    <td><span class="pill">${job.enabled ? '활성' : '중지'}</span></td>
                    <td>${operationBadge(job.operation)}</td>
                    <td>${domainBadge(job.domain)}</td>
                    <td>${providerBadge(job.provider)}</td>
                    <td class="right">${esc(jobIntervalLabel(job.intervalSeconds))}</td>
                    <td class="muted">${formatDateTime(job.lastRunAt)}</td>
                    <td class="center">
                      <div class="dataTableActions">
                        <button data-job-run="${esc(job.jobKey)}" class="success">Run</button>
                        <button class="secondary" data-job-edit-open="${esc(job.jobKey)}">설정</button>
                      </div>
                    </td>
                  </tr>
                  <tr class="hidden" data-job-edit-row="${esc(job.jobKey)}">
                    <td colspan="8">
                      <div class="card" style="margin:6px 0 0">
                        <div class="row" style="justify-content:space-between">
                          <strong>설정 편집</strong>
                          <button class="secondary" data-job-edit-close="${esc(job.jobKey)}">닫기</button>
                        </div>
                        <div class="jobSettingsBody" style="margin-top:10px">
                          <label>표시 이름 <input data-job-name="${esc(job.jobKey)}" value="${esc(jobDisplayName(job))}" placeholder="표시 이름" /></label>
                          <label>설명 <input data-job-desc="${esc(job.jobKey)}" value="${esc(job.description || '')}" placeholder="설명" /></label>
                          <label>주기(초) <input data-job-interval="${esc(job.jobKey)}" value="${esc(job.intervalSeconds)}" /></label>
                          <label>활성화 <span><input type="checkbox" data-job-enabled="${esc(job.jobKey)}" ${job.enabled ? 'checked' : ''}/> enabled</span></label>
                          <label>Provider <input class="readonlyInput" value="${esc(job.provider)}" disabled /></label>
                          <label>Handler <input class="readonlyInput" value="${esc(job.handler)}" disabled /></label>
                          <label>Operation <input class="readonlyInput" value="${esc(job.operation || 'latest')}" disabled /></label>
                          <button data-job-save="${esc(job.jobKey)}" class="success">Save</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${jobsFiltered.length === 0 ? '<p class="muted">조건에 맞는 Job이 없습니다.</p>' : ''}
          </div>
        `;
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
          if (key === 'job') return dir * String(a.displayName || a.jobKey || '').localeCompare(String(b.displayName || b.jobKey || ''));
          if (key === 'status') return dir * String(a.status || '').localeCompare(String(b.status || ''));
          if (key === 'items') return dir * compareMaybeNumber(a.itemCount ?? 0, b.itemCount ?? 0);
          if (key === 'duration') return dir * compareMaybeNumber(a.durationMs ?? 0, b.durationMs ?? 0);
          if (key === 'progress') return dir * compareMaybeNumber(a.progressPercent ?? 0, b.progressPercent ?? 0);
          if (key === 'startedAt') return dir * (new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime());
          if (key === 'finishedAt') return dir * (new Date(a.finishedAt || a.startedAt || 0).getTime() - new Date(b.finishedAt || b.startedAt || 0).getTime());
          return 0;
        });
      }

      async function loadJobRuns() {
        if ($('jobRuns')) $('jobRuns').innerHTML = renderTableSkeleton({ cols: 13, rows: 5 });
        const body = await api(`/admin/api/job-runs?${jobRunsQueryParams()}`);
        state.jobRunsPage = body.page;
        state.jobRunsTotalPages = body.totalPages;
        state.jobRunsTotal = body.total;
        renderJobRunsPager('jobRunsPagerTop');
        renderJobRunsPager('jobRunsPagerBottom');
        const rows = sortJobRuns(body.data || []);
        state.jobRunsLastRows = rows;
        const validKeys = new Set(rows.map((r) => jobRunRowSelectKey(r)));
        state.jobRunsSelected = (state.jobRunsSelected || []).filter((k) => validKeys.has(String(k)));
        const selected = new Set(state.jobRunsSelected || []);
        const allSelected = rows.length > 0 && rows.every((r) => selected.has(jobRunRowSelectKey(r)));

        if (rows.length === 0) {
          $('jobRuns').innerHTML = '<p class="muted">검색 조건에 맞는 실행 로그가 없습니다.</p>';
          return;
        }

        $('jobRuns').innerHTML = `
          ${selected.size ? `
            <div class="actionBox" style="margin-bottom:10px">
              <span class="muted">선택됨 ${selected.size}개</span>
              <div class="row">
                <button class="warning" id="jobRunsBulkRetry">선택 재시도</button>
                <button class="secondary" id="jobRunsBulkClear">선택 해제</button>
              </div>
            </div>
          ` : ''}
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
                <th data-run-sort="progress">Progress</th>
                <th data-run-sort="items" class="right">${esc(textFor('colItems'))}</th>
                <th data-run-sort="duration" class="right">${esc(textFor('colDuration'))}</th>
                <th data-run-sort="startedAt">${esc(textFor('colStarted'))}</th>
                <th data-run-sort="finishedAt">${esc(textFor('colFinished'))}</th>
                <th>${esc(textFor('colError'))}</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((run) => {
                const rowKey = jobRunRowSelectKey(run);
                return `
                <tr>
                  <td class="center"><input type="checkbox" data-job-run-select="${esc(rowKey)}" ${selected.has(rowKey) ? 'checked' : ''} /></td>
                  <td><strong>${esc(run.displayName || run.jobKey)}</strong><br/><span class="muted">${esc(run.jobKey)}</span></td>
                  <td>${runStatusPill(run.status, false)}</td>
                  <td>${operationBadge(run.operation)}</td>
                  <td>${domainBadge(run.domain || run.resultKind)}</td>
                  <td>${providerBadge(run.provider)}</td>
                  <td>${esc(run.trigger || '-')}</td>
                  <td class="muted">${run.status === 'running' && Number.isFinite(Number(run.progressPercent)) ? `${Number(run.progressPercent)}%` : '-'}</td>
                  <td class="right">${run.itemCount ?? 0}</td>
                  <td class="right">${formatDuration(run.durationMs)}</td>
                  <td class="muted">${formatDateTime(run.startedAt)}</td>
                  <td class="muted">${formatDateTime(run.finishedAt)}</td>
                  <td class="${run.errorMessage ? 'error' : 'muted'}">${esc(run.errorMessage || '-')}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        `;
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
          <div class="settingsHero">
            <span class="settingsHeroIcon">G</span>
            <div>
              <div class="cardKicker">뉴스 번역 파이프라인</div>
              <p class="summary">언어별 번역 정책, 테스트, 모델 프리셋을 한 흐름으로 관리합니다.</p>
            </div>
          </div>
          <div class="card settingsControlCard">
            <div class="row" style="justify-content:space-between;gap:10px">
              <div>
                <strong>번역 설정 흐름</strong>
                <div class="muted" style="margin-top:4px">1) Locale별 번역 정책을 고르고 2) 번역 테스트로 확인한 뒤 3) 모델 프리셋(관리)에서 리스트를 관리하세요.</div>
                ${missingKeys.length ? `<div class="muted" style="margin-top:6px"><span class="pill opReconcile">주의</span> ${esc(missingKeys.join(', '))} API 키가 없습니다. (Provider에서 설정)</div>` : ''}
              </div>
              <div class="row">
                <button class="secondary" data-view="settings-keys">Provider로 이동</button>
              </div>
            </div>
          </div>
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">Locale별 번역 정책</div>
                <div class="cardHint">Enabled / 자동 뉴스 번역 / Provider / 모델을 로케일별로 관리합니다.</div>
              </div>
            </div>
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
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">번역 테스트</div>
                <div class="cardHint">현재 Provider/모델 설정으로 테스트 문구를 번역합니다.</div>
              </div>
            </div>
            <div class="settingsFormRow">
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
            <div class="providerTile">
              <div class="providerTileHead">
                <span class="providerGlyph">${showModel ? 'AI' : 'API'}</span>
                <div class="providerTitle">
                  <strong>${esc(s.provider)}</strong>
                  <span class="muted">${showModel ? '번역/요약 모델 Provider' : '데이터 수집 Provider'}</span>
                </div>
                <span class="pill ${s.hasApiKey ? 'pillStatus--ok' : 'pillStatus--warn'}">${s.hasApiKey ? `설정됨 ${esc(s.maskedApiKey)}` : '키 없음'}</span>
              </div>
              <div class="providerTileBody">
                <label class="switchRow providerSwitch">
                  <input class="switchInput" type="checkbox" data-provider-enabled="${esc(s.provider)}" ${s.enabled ? 'checked' : ''}/>
                  <span class="switchUi" aria-hidden="true"></span>
                  <span class="switchLabel">Enabled</span>
                </label>
                ${showModel ? `
                  <label class="fieldLabel providerModel">기본 모델
                    <select data-provider-model="${esc(s.provider)}">
                      <option value="">모델 선택</option>
                      ${renderModelOptions(models, s.defaultModel || '')}
                    </select>
                  </label>
                ` : '<div class="providerModel muted">모델 설정 없음</div>'}
                <label class="fieldLabel providerKey">API Key
                  <input class="keyInput" data-provider-key="${esc(s.provider)}" type="password" placeholder="새 API key 입력 시 교체" />
                </label>
              </div>
              <div class="providerActions">
                <button data-provider-save="${esc(s.provider)}" class="success">Save</button>
                <button data-provider-clear="${esc(s.provider)}" class="danger">키 삭제</button>
              </div>
            </div>
          `;
        };
        $('providerSettings').innerHTML = `
          <div class="settingsSectionGrid">
            <div class="card settingsControlCard">
              <div class="cardHead">
                <div class="cardHeadMain">
                  <div class="cardKicker">LLM Provider</div>
                  <div class="cardHint">OpenAI/Claude는 기본 모델과 API Key를 함께 관리합니다.</div>
                </div>
                <div class="cardHeadActions">
                  <button class="secondary" data-open-model-presets="true">모델 프리셋 관리</button>
                </div>
              </div>
              <div class="providerTileGrid">
                ${llm.map((s) => renderRow(s, { showModel: true })).join('') || '<p class="muted">LLM provider가 없습니다.</p>'}
              </div>
            </div>

            <div class="card settingsControlCard">
              <div class="cardHead">
                <div class="cardHeadMain">
                  <div class="cardKicker">Data Provider</div>
                  <div class="cardHint">Finnhub, YouTube, CoinGecko 등 수집 Provider의 키와 활성 상태를 관리합니다.</div>
                </div>
              </div>
              <div class="providerTileGrid">
                ${data.map((s) => renderRow(s, { showModel: false })).join('') || '<p class="muted">데이터 provider가 없습니다.</p>'}
              </div>
            </div>
          </div>
          <div id="uiModelPresets"></div>
        `;
      }

      async function loadMarketLists() {
        const body = await api('/admin/api/market-lists');
        state.marketLists = body.data;
        const lists = Array.isArray(body.data) ? body.data : [];
        $('marketLists').innerHTML = `
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">마켓 리스트</div>
                <div class="cardHint">앱 화면과 수집 Job이 공통으로 사용하는 종목 묶음입니다.</div>
              </div>
            </div>
            <div class="settingsSectionBody">
              ${lists.length === 0 ? '<p class="muted">리스트가 없습니다.</p>' : lists.map((list) => `
                <div class="card marketListCard">
                  <div class="cardHead">
                    <div class="cardHeadMain">
                      <div><strong>${esc(list.displayName)}</strong></div>
                      <div class="summary">${esc(list.description || '')}</div>
                      <div class="marketListMetaRow">
                        <span class="pill pill--subtle">${esc(list.key)}</span>
                        <span class="pill">${Number(list.count) || 0}개</span>
                        <span class="marketListMetaItem muted"><span class="marketListMetaLabel">업데이트</span>${formatDateTime(list.updatedAt)}</span>
                      </div>
                    </div>
                    <div class="cardHeadActions">
                      <button data-market-list-open="${esc(list.key)}" class="secondary">관리</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      function renderNewsSources() {
        const host = $('newsSources');
        if (!host) return;
        const cat = state.newsSourcesCategory || 'global';
        const rows = [...(state.newsSources || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)));
        const policy = state.newsSourceSettings?.autoEnableNewSources || { global: true, crypto: true };
        const aliasesByCat = state.newsSourceSettings?.aliases || { global: {}, crypto: {} };
        const aliasTable = aliasesByCat[cat] || {};
        const aliasCountFor = (name) => Object.entries(aliasTable).filter(([, v]) => String(v || '') === String(name || '')).length;
        host.innerHTML = `
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('newsSourcesTitle') || '뉴스 출처')}</div>
                <div class="cardHint">${esc(textFor('newsSourcesHint'))}</div>
              </div>
              <div class="cardHeadActions">
                <button class="secondary" id="refreshNewsSourcesBtn">${esc(textFor('btnRefresh'))}</button>
              </div>
            </div>
            <div class="sourceControlGrid">
              <div class="sourceControlBlock">
                <div class="sourceControlLabel">카테고리</div>
                <div class="tabs tabs--compact">
                  <button type="button" class="tabBtn ${cat === 'global' ? 'active' : ''}" data-news-sources-tab="global">${esc(textFor('newsSourcesCatGlobal'))}</button>
                  <button type="button" class="tabBtn ${cat === 'crypto' ? 'active' : ''}" data-news-sources-tab="crypto">${esc(textFor('newsSourcesCatCrypto'))}</button>
                </div>
              </div>
              <div class="sourceControlBlock sourceControlBlock--wide">
                <div class="sourceControlLabel">운영 정책</div>
                <div class="sourceSwitches">
                <label class="switchRow">
                  <input class="switchInput" type="checkbox" id="newsSourcesAutoEnable" ${policy[cat] !== false ? 'checked' : ''} />
                  <span class="switchUi" aria-hidden="true"></span>
                  <span class="switchLabel">${esc(textFor('newsSourcesAutoEnable'))}</span>
                </label>
                <label class="switchRow">
                  <input class="switchInput" type="checkbox" id="newsSourcesShowHidden" ${state.newsSourcesShowHidden ? 'checked' : ''} />
                  <span class="switchUi" aria-hidden="true"></span>
                  <span class="switchLabel">${esc(textFor('newsSourcesShowHidden'))}</span>
                </label>
                </div>
              </div>
              <div class="sourceControlBlock sourceControlBlock--actions">
                <button class="secondary" id="saveNewsSourceSettingsBtn">${esc(textFor('btnSave'))}</button>
              </div>
            </div>
            <div class="sourceAddPanel">
              <div>
                <div class="sourceControlLabel">출처 추가</div>
                <div class="cardHint">새 출처명은 현재 카테고리에 추가됩니다.</div>
              </div>
              <input id="newsSourceAddName" class="newsSourcesAddInput" placeholder="${esc(textFor('newsSourceAddPh'))}" value="${esc(state.newsSourceDraft || '')}" />
              <button class="secondary" id="addNewsSourceBtn">${esc(textFor('btnAdd'))}</button>
            </div>
            <div class="newsSourcesTable">
              <div class="sourceListHead">
                <div>
                  <div class="cardKicker">출처 리스트</div>
                  <div class="cardHint">${rows.length}개 출처 · 순서와 노출 상태를 관리합니다.</div>
                </div>
                <span class="pill">${esc(cat)}</span>
              </div>
              <table class="settingsTable sourceTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${esc(textFor('colName'))}</th>
                    <th>${esc(textFor('colEnabled'))}</th>
                    <th>${esc(textFor('colOrder'))}</th>
                    <th>${esc(textFor('colAction'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((s, idx) => `
                    <tr class="${s.hidden ? 'mutedRow' : ''}">
                      <td class="muted">${idx + 1}</td>
                      <td><strong>${esc(s.name)}</strong>${s.hidden ? ` <span class="pill">${esc(textFor('newsSourcesHide'))}</span>` : ''}</td>
                      <td><input type="checkbox" data-news-source-enabled="${esc(s.id)}" ${s.enabled ? 'checked' : ''} ${s.hidden ? 'disabled' : ''}/></td>
                      <td class="muted">${Number(s.order) || (idx + 1)}</td>
                      <td class="tableActions">
                        <button class="iconBtn" title="Move up" data-news-source-move="up" data-news-source-id="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>↑</button>
                        <button class="iconBtn" title="Move down" data-news-source-move="down" data-news-source-id="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>↓</button>
                        <button class="secondary compactBtn" data-news-source-alias-open="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>별칭 ${aliasCountFor(s.name) ? `(${aliasCountFor(s.name)})` : ''}</button>
                        <button class="secondary compactBtn" data-news-source-toggle-hidden="${esc(s.id)}">${esc(s.hidden ? textFor('newsSourcesUnhide') : textFor('newsSourcesHide'))}</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${rows.length === 0 ? `<p class="muted">${esc(textFor('newsSourcesEmpty'))}</p>` : ''}
            </div>
            <div class="cardFoot">
              <button class="success" id="saveNewsSourcesBtn">${esc(textFor('btnSave'))}</button>
            </div>
          </div>
        `;
      }

      async function loadNewsSources() {
        const cat = state.newsSourcesCategory || 'global';
        const includeHidden = state.newsSourcesShowHidden ? '&includeHidden=1' : '';
        const body = await api(`/admin/api/news-sources?category=${encodeURIComponent(cat)}${includeHidden}`);
        state.newsSources = Array.isArray(body.data) ? body.data : [];
        renderNewsSources();
      }

      async function loadNewsSourceSettings() {
        const body = await api('/admin/api/news-source-settings');
        state.newsSourceSettings = body.data || state.newsSourceSettings;
        renderNewsSources();
      }

      async function saveNewsSourceSettings() {
        const cat = state.newsSourcesCategory || 'global';
        const autoEnable = !!$('newsSourcesAutoEnable')?.checked;
        const patch = {
          autoEnableNewSources: { [cat]: autoEnable },
        };
        const body = await api('/admin/api/news-source-settings', { method: 'PATCH', body: JSON.stringify(patch) });
        state.newsSourceSettings = body.data || state.newsSourceSettings;
        showToast(textFor('toastSaved') || 'Saved', cat, { kind: 'success' });
        await loadNewsSources();
      }

      function closeNewsSourceAliasDialog() {
        state.newsSourceAliasDraft = null;
        if ($('newsSourceAliasDialog')) $('newsSourceAliasDialog').classList.add('hidden');
      }

      function renderNewsSourceAliasDialog() {
        const draft = state.newsSourceAliasDraft;
        if (!draft) {
          if ($('newsSourceAliasDialog')) $('newsSourceAliasDialog').classList.add('hidden');
          return;
        }
        $('newsSourceAliasDialog').classList.remove('hidden');
        $('newsSourceAliasDialogTitle').textContent = `${draft.sourceName} · 별칭`;
        $('newsSourceAliasDialogMeta').textContent = `카테고리: ${draft.category} (global/crypto는 별칭이 분리 적용됩니다)`;
        $('newsSourceAliasCount').textContent = `별칭 ${draft.aliases.length}개`;
        $('newsSourceAliasRows').innerHTML = `
          <div class="aliasPolicyHint muted">
            매칭 규칙: 별칭/출처명은 저장 시 앞뒤 공백을 제거하고 소문자로 비교합니다. (대소문자만 다른 경우도 동일 처리)
          </div>
          ${draft.aliases.map((a, idx) => `
          <div class="symbolRow">
            <div class="muted">${idx + 1}</div>
            <input class="readonlyInput" value="${esc(a)}" disabled />
            <button class="danger" data-news-source-alias-remove="${idx}">삭제</button>
          </div>
        `).join('') || '<p class="muted">별칭이 없습니다.</p>'}
        `;
      }

      function openNewsSourceAliasDialog(sourceId) {
        const cat = state.newsSourcesCategory || 'global';
        const src = (state.newsSources || []).find((s) => String(s.id) === String(sourceId));
        if (!src) return;
        const table = state.newsSourceSettings?.aliases?.[cat] || {};
        const aliases = Object.entries(table)
          .filter(([, v]) => String(v || '') === String(src.name || ''))
          .map(([k]) => String(k || '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        state.newsSourceAliasDraft = { category: cat, sourceId: src.id, sourceName: src.name, aliases };
        if ($('newsSourceAliasAdd')) $('newsSourceAliasAdd').value = '';
        renderNewsSourceAliasDialog();
      }

      async function saveNewsSourceAliasesFromDialog() {
        const draft = state.newsSourceAliasDraft;
        if (!draft) return;
        const { category: cat, sourceName, aliases } = draft;
        const prev = state.newsSourceSettings?.aliases?.[cat] || {};
        const next = { ...prev };
        // Remove existing aliases pointing to this sourceName.
        for (const [k, v] of Object.entries(next)) {
          if (String(v || '') === String(sourceName || '')) delete next[k];
        }
        // Add aliases (aliasKey is lowercased by server; keep simple normalization here).
        for (const raw of aliases) {
          const key = String(raw || '').trim().toLowerCase();
          if (!key) continue;
          if (key === String(sourceName || '').trim().toLowerCase()) continue;
          next[key] = sourceName;
        }
        const patch = { aliases: { [cat]: next } };
        const body = await api('/admin/api/news-source-settings', { method: 'PATCH', body: JSON.stringify(patch) });
        state.newsSourceSettings = body.data || state.newsSourceSettings;
        showToast(textFor('toastSaved') || 'Saved', `${sourceName}`, { kind: 'success' });
        closeNewsSourceAliasDialog();
        renderNewsSources();
      }

      function normalizeNewsSourceIdFromName(name) {
        const s = String(name || '').trim().toLowerCase();
        let h = 0;
        for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return `src-${h.toString(16)}`;
      }

      async function saveNewsSources() {
        const category = state.newsSourcesCategory || 'global';
        const next = [...(state.newsSources || [])]
          .map((s, idx) => ({
            id: String(s.id || '').trim(),
            name: String(s.name || '').trim(),
            category,
            enabled: s.enabled !== false,
            order: idx + 1,
          }))
          .filter((s) => s.id && s.name);
        const body = await api('/admin/api/news-sources', { method: 'PUT', body: JSON.stringify({ category, items: next }) });
        state.newsSources = Array.isArray(body.data) ? body.data : next;
        showToast(textFor('toastSaved') || 'Saved', `${state.newsSources.length}`, { kind: 'success' });
        renderNewsSources();
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

      function pad2(n) {
        return String(Math.max(0, Number(n) || 0)).padStart(2, '0');
      }

      function ymdFromParts(y, m, d) {
        return `${y}-${pad2(m)}-${pad2(d)}`;
      }

      function daysInMonth(y, m) {
        return new Date(y, m, 0).getDate();
      }

      function calendarMonthMeta(ym) {
        const parts = String(ym || '').split('-');
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
        const first = ymdFromParts(y, m, 1);
        const last = ymdFromParts(y, m, daysInMonth(y, m));
        return { y, m, first, last };
      }

      function shiftCalendarMonth(ym, delta) {
        const meta = calendarMonthMeta(ym);
        if (!meta) return ym;
        let { y, m } = meta;
        m += delta;
        while (m > 12) {
          m -= 12;
          y += 1;
        }
        while (m < 1) {
          m += 12;
          y -= 1;
        }
        return `${y}-${pad2(m)}`;
      }

      function initCalendarMonthIfNeeded() {
        if (state.calendarMonthYm) return;
        const t = new Date();
        state.calendarMonthYm = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
        state.calendarSelectedYmd = ymd(t);
      }

      function adminBcp47() {
        const lang = localStorage.getItem('signalAdminLanguage') || 'ko';
        if (lang === 'en') return 'en-US';
        if (lang === 'ja') return 'ja-JP';
        return 'ko-KR';
      }

      function formatAdminCalendarDayHeading(ymdStr) {
        if (!ymdStr) return '';
        const d = new Date(`${ymdStr}T12:00:00`);
        if (!Number.isFinite(d.getTime())) return ymdStr;
        return new Intl.DateTimeFormat(adminBcp47(), {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(d);
      }

      function renderAdminCalendarGrid() {
        const host = $('adminCalendarGrid');
        if (!host) return;
        const meta = calendarMonthMeta(state.calendarMonthYm);
        if (!meta) return;
        const { y, m, first } = meta;
        const dim = daysInMonth(y, m);
        const eventDates = new Set(
          (state.calendarMonthRows || []).map((r) => String(r.date || '').slice(0, 10)).filter(Boolean),
        );
        const sel = state.calendarSelectedYmd;
        const firstD = new Date(`${first}T12:00:00`);
        const startWeekday = firstD.getDay();
        const todayYmd = ymd(new Date());
        const weekHtml = [0, 1, 2, 3, 4, 5, 6]
          .map((w) => `<div class="calWeekday" aria-hidden="true">${esc(textFor(`calWeek${w}`))}</div>`)
          .join('');
        let cells = '';
        for (let i = 0; i < startWeekday; i += 1) cells += '<div class="calCell calCell--pad" aria-hidden="true"></div>';
        for (let d = 1; d <= dim; d += 1) {
          const ymdStr = ymdFromParts(y, m, d);
          const has = eventDates.has(ymdStr);
          const isSel = sel === ymdStr;
          const isToday = ymdStr === todayYmd;
          cells += `<button type="button" class="calCell ${has ? 'calCell--has' : 'calCell--muted'} ${isSel ? 'calCell--selected' : ''} ${isToday ? 'calCell--today' : ''}" data-cal-day="${esc(ymdStr)}" aria-pressed="${isSel ? 'true' : 'false'}">${d}</button>`;
        }
        host.innerHTML = `
          <div class="calendarMonthWrap">
            <div class="calWeekdays">${weekHtml}</div>
            <div class="calendarGrid" role="grid" aria-label="${esc(textFor('pageCalendarTitle'))}">${cells}</div>
          </div>`;
      }

      function renderCalendarDayTable() {
        const host = $('calendarDayList') || $('calendar');
        if (!host) return;
        const sel = state.calendarSelectedYmd;
        const headEl = $('calendarDayHeadingText');
        if (headEl) {
          headEl.textContent = textForVars('calendarEventsForDayOn', { date: formatAdminCalendarDayHeading(sel) });
        }
        const rows = (state.calendarMonthRows || []).filter((r) => String(r.date || '').slice(0, 10) === sel);
        host.innerHTML =
          rows.length === 0
            ? `<p class="muted">${esc(textFor('calendarEmptyDay'))}</p>`
            : `
            <table>
              <thead>
                <tr>
                  <th>${esc(textFor('colDate'))}</th>
                  <th>${esc(textFor('colType'))}</th>
                  <th>${esc(textFor('colTitle'))}</th>
                  <th>${esc(textFor('colMeta'))}</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (item) => `
                  <tr>
                    <td class="muted">${esc(item.date || '-')}</td>
                    <td><span class="pill">${esc(item.type || '-')}</span></td>
                    <td><strong>${esc(item.title || '-')}</strong></td>
                    <td class="muted">${esc(item.country || item.symbol || '-')}</td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          `;
      }

      async function loadCalendar() {
        const host = $('calendarDayList') || $('calendar');
        if (!host) return;
        initCalendarMonthIfNeeded();
        if ($('calendarMonthPick')) $('calendarMonthPick').value = state.calendarMonthYm;
        const meta = calendarMonthMeta(state.calendarMonthYm);
        if (!meta) return;
        if ($('calendarFrom')) $('calendarFrom').value = meta.first;
        if ($('calendarTo')) $('calendarTo').value = meta.last;
        const params = new URLSearchParams({ page: '1', pageSize: '500', from: meta.first, to: meta.last });
        const ty = $('calendarType')?.value?.trim();
        if (ty) params.set('type', ty);
        const cq = $('calendarQuery')?.value?.trim();
        if (cq) params.set('q', cq);
        const sym = $('calendarSymbol')?.value?.trim();
        if (sym) params.set('symbol', sym.toUpperCase());
        const body = await api(`/admin/api/calendar?${params.toString()}`);
        state.calendarMonthRows = Array.isArray(body.data) ? body.data : [];
        state.calendarTotal = body.total;
        state.calendarPage = body.page;
        state.calendarTotalPages = body.totalPages;
        if (!state.calendarSelectedYmd) state.calendarSelectedYmd = ymd(new Date());
        if (!state.calendarMonthRows.some((r) => String(r.date || '').slice(0, 10) === state.calendarSelectedYmd)) {
          const prefix = `${meta.y}-${pad2(meta.m)}`;
          const firstHit = state.calendarMonthRows.find((r) => String(r.date || '').startsWith(prefix));
          state.calendarSelectedYmd = firstHit ? String(firstHit.date).slice(0, 10) : meta.first;
        }
        renderAdminCalendarGrid();
        renderCalendarDayTable();
      }

      async function loadYoutube() {
        if ($('youtube')) $('youtube').innerHTML = renderTableSkeleton({ cols: 2, rows: 4 });
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
        if ($('news')) $('news').innerHTML = renderTableSkeleton({ cols: 2, rows: 4 });
        const body = await api(`/admin/api/news?${newsQueryParams()}`);
        state.newsPage = body.page;
        state.newsTotalPages = body.totalPages;
        state.newsTotal = body.total;
        renderPager('newsPagerTop');
        renderPager('newsPagerBottom');
        const locale = $('newsLocale').value;
        $('news').innerHTML =
          !body.data || body.data.length === 0
            ? '<p class="muted">검색 조건에 맞는 뉴스가 없습니다.</p>'
            : `
              <div class="card card--elevated">
                <div class="cardHead">
                  <div class="cardHeadMain">
                    <div class="cardKicker">News</div>
                    <div class="cardHint">행을 펼쳐 번역을 편집하고, 선택 후 일괄 작업을 수행합니다.</div>
                  </div>
                </div>
                <div class="newsTable">
                  <table class="newsTableTable">
                    <thead>
                      <tr>
                        <th style="width:34px"></th>
                        <th style="width:120px">시간</th>
                        <th style="width:110px">출처</th>
                        <th style="width:92px">카테고리</th>
                        <th style="width:92px">상태</th>
                        <th>제목</th>
                        <th style="width:210px">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${body.data
                        .map((item) => {
                          const translation = item.translations.find((t) => t.locale === locale) || {};
                          const title = String(item.originalTitle || item.title || '-');
                          const source = String(item.sourceName || '-');
                          const published = formatDateTime(item.publishedAt);
                          const category = String(item.category || '-');
                          const status = String(item.translationStatus || '-');
                          const provider = String(item.provider || '-');
                          return `
                            <tr class="newsRow" data-news-row="${esc(item.id)}">
                              <td><input type="checkbox" data-news-id="${esc(item.id)}" /></td>
                              <td class="muted">${esc(published)}</td>
                              <td><span class="pill">${esc(source)}</span></td>
                              <td><span class="pill">${esc(category)}</span></td>
                              <td><span class="pill">${esc(status)}</span></td>
                              <td>
                                <div class="newsTitle">${esc(title)}</div>
                                <div class="newsMeta muted">${esc(provider)}</div>
                              </td>
                              <td class="tableActions">
                                <button class="secondary" data-news-expand="${esc(item.id)}">편집</button>
                                <a class="developerLink" href="${esc(item.sourceUrl || '#')}" target="_blank" rel="noreferrer">원문 ↗</a>
                              </td>
                            </tr>
                            <tr class="newsRowExpand hidden" data-news-expand-row="${esc(item.id)}">
                              <td colspan="7">
                                <div class="newsEdit">
                                  <div class="newsEditHead">
                                    <div>
                                      <div class="muted">번역 (${esc(locale)})</div>
                                      <div class="newsEditTitle">${esc(title)}</div>
                                    </div>
                                    <div class="row">
                                      <button class="secondary" data-news-collapse="${esc(item.id)}">닫기</button>
                                      <button data-save-translation="${esc(item.id)}" class="success">저장</button>
                                    </div>
                                  </div>
                                  <div class="newsEditGrid">
                                    <label class="fieldLabel">
                                      <span>Title</span>
                                      <textarea class="jsonEditor" data-title="${esc(item.id)}">${esc(translation.title || item.title || '')}</textarea>
                                    </label>
                                    <label class="fieldLabel">
                                      <span>Summary</span>
                                      <textarea class="jsonEditor" data-summary="${esc(item.id)}">${esc(translation.summary || item.summary || '')}</textarea>
                                    </label>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
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

      function updateResetUi() {
        const boxes = [...document.querySelectorAll('[data-reset-target]')];
        const selectedBoxes = boxes.filter((box) => box.checked);
        const selectedNames = selectedBoxes.map((box) => {
          const title = box.closest('.resetOption')?.querySelector('strong')?.textContent;
          return title || box.dataset.resetTarget;
        });
        const confirmText = $('resetConfirmText')?.value.trim() || '';
        if ($('resetSelectionInfo')) $('resetSelectionInfo').textContent = `${selectedBoxes.length}개 선택됨`;
        if ($('resetSelectedList')) {
          $('resetSelectedList').textContent = selectedNames.length ? selectedNames.join(', ') : '선택된 대상이 없습니다.';
        }
        if ($('resetDataBtn')) $('resetDataBtn').disabled = selectedBoxes.length === 0 || confirmText !== 'RESET';
      }

      document.addEventListener('click', async (event) => {
        const target = event.target;
        try {
          if (target?.dataset?.newsExpand) {
            const id = target.dataset.newsExpand;
            const row = document.querySelector(`[data-news-expand-row="${CSS.escape(id)}"]`);
            if (row) row.classList.remove('hidden');
            return;
          }
          if (target?.dataset?.newsCollapse) {
            const id = target.dataset.newsCollapse;
            const row = document.querySelector(`[data-news-expand-row="${CSS.escape(id)}"]`);
            if (row) row.classList.add('hidden');
            return;
          }
          if (target?.id === 'hamburgerBtn') {
            document.body.classList.toggle('sideOpen');
            if ($('sideOverlay')) $('sideOverlay').classList.toggle('hidden', !document.body.classList.contains('sideOpen'));
            return;
          }
          if (target?.id === 'collapseBtn') {
            document.body.classList.toggle('sideCollapsed');
            return;
          }
          if (target?.id === 'sideOverlay') {
            document.body.classList.remove('sideOpen');
            $('sideOverlay')?.classList.add('hidden');
            return;
          }
          if (target?.id === 'headerNotifBtn') {
            await refreshNotifications();
            openPanel('notifPanel');
            return;
          }
          if (target?.id === 'closeNotifPanel') {
            closePanel('notifPanel');
            return;
          }
          if (target?.id === 'headerProfileBtn') {
            openPanel('profileMenu');
            return;
          }
          if (target?.id === 'closeProfileMenu') {
            closePanel('profileMenu');
            return;
          }
          if (target?.id === 'profileLogoutBtn') {
            closePanel('profileMenu');
            $('logoutBtn')?.click();
            return;
          }
          if (target?.id === 'closeGlobalSearch') {
            closePanel('globalSearchPanel');
            return;
          }
          if (target?.dataset?.searchHit) {
            const idx = Number(target.dataset.searchHit);
            const hit = (searchIndex.items || [])[idx];
            closePanel('globalSearchPanel');
            if (hit?.action) await hit.action();
            return;
          }
          if (target?.id === 'refreshJobsBtn') {
            await Promise.all([loadJobs(), loadJobRuns(), loadDashboard()]);
            showToast('새로고침', 'Jobs/Logs refreshed', { kind: 'info' });
            return;
          }
          if (target?.id === 'refreshMonitoringBtn') {
            await loadMonitoring();
            showToast('새로고침', 'Monitoring refreshed', { kind: 'info' });
            return;
          }
          if (target?.dataset?.newsSourceAliasOpen) {
            openNewsSourceAliasDialog(target.dataset.newsSourceAliasOpen);
            return;
          }
          if (target?.id === 'closeNewsSourceAliasDialog' || target?.id === 'cancelNewsSourceAliasDialog') {
            closeNewsSourceAliasDialog();
            return;
          }
          if (target?.id === 'newsSourceAliasDialog') {
            closeNewsSourceAliasDialog();
            return;
          }
          if (target?.id === 'addNewsSourceAlias') {
            if (!state.newsSourceAliasDraft) return;
            const raw = String($('newsSourceAliasAdd')?.value || '').trim();
            if (!raw) return;
            if (!state.newsSourceAliasDraft.aliases.includes(raw)) state.newsSourceAliasDraft.aliases.push(raw);
            state.newsSourceAliasDraft.aliases = [...new Set(state.newsSourceAliasDraft.aliases)].filter(Boolean).sort((a, b) => a.localeCompare(b));
            if ($('newsSourceAliasAdd')) $('newsSourceAliasAdd').value = '';
            renderNewsSourceAliasDialog();
            return;
          }
          if (target?.dataset?.newsSourceAliasRemove) {
            if (!state.newsSourceAliasDraft) return;
            const idx = Number(target.dataset.newsSourceAliasRemove);
            if (Number.isInteger(idx) && idx >= 0) {
              state.newsSourceAliasDraft.aliases.splice(idx, 1);
              renderNewsSourceAliasDialog();
            }
            return;
          }
          if (target?.id === 'saveNewsSourceAliasDialog') {
            await saveNewsSourceAliasesFromDialog();
            return;
          }
          if (target?.id === 'jobRunsBulkClear') {
            state.jobRunsSelected = [];
            await loadJobRuns();
            return;
          }
          if (target?.id === 'jobRunsBulkRetry') {
            const selectedRunKeys = [...new Set(state.jobRunsSelected || [])].filter(Boolean);
            const rows = Array.isArray(state.jobRunsLastRows) ? state.jobRunsLastRows : [];
            const jobKeys = jobKeysForSelectedJobRuns(rows, selectedRunKeys);
            openConfirm({
              title: '선택 재시도',
              desc: '선택한 실행 로그에 해당하는 Job을 수동 실행(강제)합니다.',
              body: `실행 로그 ${selectedRunKeys.length}개 → Job ${jobKeys.length}개\n${jobKeys.length ? jobKeys.join(', ') : '(없음)'}`,
              okText: '재시도',
              danger: false,
              onConfirm: async () => {
                for (const key of jobKeys) {
                  await api(`/admin/api/jobs/${encodeURIComponent(key)}/run`, { method: 'POST' });
                }
                showToast('재시도 요청', `${jobKeys.length}개 job 실행`, { kind: 'success' });
                state.jobRunsSelected = [];
                await Promise.all([loadJobRuns(), loadDashboard()]);
              },
            });
            return;
          }
          if (target?.id === 'headerHelpBtn') {
            showToast(
              '도움말',
              '전역 검색: ⌘/Ctrl+K · 알림/프로필은 상단 패널 · Job 로그는 행 단위 선택 후 일괄 재시도',
              { kind: 'info' },
            );
            return;
          }
          if (target?.dataset?.jobEditOpen) {
            const key = target.dataset.jobEditOpen;
            const row = document.querySelector(`[data-job-edit-row="${esc(key)}"]`);
            if (row) row.classList.toggle('hidden');
            return;
          }
          if (target?.dataset?.jobEditClose) {
            const key = target.dataset.jobEditClose;
            const row = document.querySelector(`[data-job-edit-row="${esc(key)}"]`);
            if (row) row.classList.add('hidden');
            return;
          }
          if (target?.id === 'confirmClose' || target?.id === 'confirmCancel') {
            closeConfirm();
            return;
          }
          if (target?.id === 'confirmOk') {
            const fn = confirmState.onConfirm;
            closeConfirm();
            if (fn) await fn();
            return;
          }
          if (target.dataset && target.dataset.comingSoon === 'true') {
            showToast('준비중', '해당 메뉴는 아직 구현되지 않았습니다.');
            return;
          }
          if (target.dataset.openModelPresets) {
            state.openModelPresetsOnTranslations = true;
            await switchView('translations');
            return;
          }
          if (target?.id === 'jobListReset') {
            state.operationFilter = 'all';
            state.jobListEnabled = 'all';
            state.jobListDomain = 'all';
            state.jobListProvider = 'all';
            state.jobListQuery = '';
            state.jobListSort = 'name';
            await loadJobs();
            return;
          }
          if (target.dataset.dashboardOp) {
            state.dashboardOperationFilter = target.dataset.dashboardOp || 'all';
            await loadDashboard();
            return;
          }
          if (target?.id === 'jobRunsSelectAll') {
            // handled by change listener
            return;
          }
          if (target?.dataset?.jobRunSelect) {
            // handled by change listener
            return;
          }
          if (target?.dataset?.runSort) {
            const key = target.dataset.runSort;
            if (state.jobRunsSortKey === key) state.jobRunsSortDir = state.jobRunsSortDir === 'asc' ? 'desc' : 'asc';
            else { state.jobRunsSortKey = key; state.jobRunsSortDir = 'desc'; }
            await loadJobRuns();
            const params = new URLSearchParams(window.location.search);
            params.set('runSort', state.jobRunsSortKey || 'finishedAt');
            params.set('runDir', state.jobRunsSortDir || 'desc');
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            return;
          }
          const toastCloseBtn = typeof target.closest === 'function' ? target.closest('[data-toast-close]') : null;
          if (toastCloseBtn instanceof HTMLElement && toastCloseBtn.dataset.toastClose) {
            dismissToast(toastCloseBtn.dataset.toastClose);
            return;
          }
          if (target.dataset.view) await switchView(target.dataset.view);
          // Close sidebar overlay after navigation (tablet)
          if (document.body.classList.contains('sideOpen')) {
            document.body.classList.remove('sideOpen');
            $('sideOverlay')?.classList.add('hidden');
          }
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
            const key = target.dataset.openJob;
            setTimeout(() => {
              document.querySelector(`[data-job-name="${esc(key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 0);
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
            openConfirm({
              title: 'API Key 삭제',
              desc: '해당 Provider의 API Key를 삭제합니다.',
              body: `Provider: ${provider}`,
              okText: '삭제',
              danger: true,
              onConfirm: async () => {
                await api(`/admin/api/provider-settings/${provider}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ clearApiKey: true }),
                });
                showToast('삭제 완료', provider, { kind: 'success' });
                await loadProviderSettings();
              },
            });
            return;
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
          if (target.id === 'refreshNewsSourcesBtn') {
            await loadNewsSources();
            return;
          }
          if (target.dataset.newsSourcesTab) {
            state.newsSourcesCategory = target.dataset.newsSourcesTab || 'global';
            await loadNewsSourceSettings();
            await loadNewsSources();
            return;
          }
          if (target.id === 'saveNewsSourceSettingsBtn') {
            await saveNewsSourceSettings();
            return;
          }
          if (target.id === 'addNewsSourceBtn') {
            const name = String($('newsSourceAddName')?.value || '').trim();
            state.newsSourceDraft = name;
            if (!name) return;
            const id = normalizeNewsSourceIdFromName(name);
            const existing = (state.newsSources || []).find((s) => s.id === id);
            if (existing) {
              existing.enabled = true;
            } else {
              const maxOrder = (state.newsSources || []).reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);
              (state.newsSources || []).push({ id, name, enabled: true, order: maxOrder + 1 });
            }
            state.newsSourceDraft = '';
            if ($('newsSourceAddName')) $('newsSourceAddName').value = '';
            renderNewsSources();
            return;
          }
          if (target.dataset.newsSourceMove && target.dataset.newsSourceId) {
            const dir = target.dataset.newsSourceMove;
            const id = target.dataset.newsSourceId;
            const list = [...(state.newsSources || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
            const idx = list.findIndex((s) => s.id === id);
            if (idx < 0) return;
            const swapWith = dir === 'up' ? idx - 1 : idx + 1;
            if (swapWith < 0 || swapWith >= list.length) return;
            const tmp = list[idx];
            list[idx] = list[swapWith];
            list[swapWith] = tmp;
            list.forEach((s, i) => { s.order = i + 1; });
            state.newsSources = list;
            renderNewsSources();
            return;
          }
          if (target.dataset.newsSourceDelete) {
            const id = target.dataset.newsSourceDelete;
            state.newsSources = (state.newsSources || []).filter((s) => s.id !== id);
            state.newsSources.forEach((s, i) => { s.order = i + 1; });
            renderNewsSources();
            return;
          }
          if (target.dataset.newsSourceToggleHidden) {
            const id = target.dataset.newsSourceToggleHidden;
            const hit = (state.newsSources || []).find((s) => s.id === id);
            if (!hit) return;
            hit.hidden = !hit.hidden;
            if (hit.hidden) hit.enabled = false;
            renderNewsSources();
            return;
          }
          if (target.id === 'saveNewsSourcesBtn') {
            await saveNewsSources();
            return;
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
            state.calendarSelectedYmd = '';
            await loadCalendar();
          }
          if (target.dataset.calMonthPrev != null) {
            state.calendarMonthYm = shiftCalendarMonth(state.calendarMonthYm, -1);
            state.calendarSelectedYmd = '';
            await loadCalendar();
            return;
          }
          if (target.dataset.calMonthNext != null) {
            state.calendarMonthYm = shiftCalendarMonth(state.calendarMonthYm, 1);
            state.calendarSelectedYmd = '';
            await loadCalendar();
            return;
          }
          if (target.dataset.calDay) {
            state.calendarSelectedYmd = target.dataset.calDay;
            renderAdminCalendarGrid();
            renderCalendarDayTable();
            return;
          }
          if (target.dataset.youtubePage === 'prev' && state.youtubePage > 1) {
            state.youtubePage -= 1;
            await loadYoutube();
          }
          if (target.dataset.youtubePage === 'next' && state.youtubePage < state.youtubeTotalPages) {
            state.youtubePage += 1;
            await loadYoutube();
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
            const locale = $('newsLocale').value;
            openConfirm({
              title: '선택 번역',
              desc: '선택한 뉴스의 번역을 다시 생성합니다.',
              body: `대상: ${ids.length}개 · locale=${locale}`,
              okText: '번역',
              danger: false,
              onConfirm: async () => {
                await api('/admin/api/news/retranslate', { method: 'POST', body: JSON.stringify({ ids, locale }) });
                showToast('번역 요청', `${ids.length}개`, { kind: 'success' });
                await loadNews();
              },
            });
            return;
          }
          if (target.id === 'deleteSelectedNewsBtn') {
            const ids = selectedNewsIds();
            if (ids.length === 0) return;
            openConfirm({
              title: '선택 삭제',
              desc: '선택한 뉴스와 번역을 삭제합니다.',
              body: `대상: ${ids.length}개`,
              okText: '삭제',
              danger: true,
              onConfirm: async () => {
                await api('/admin/api/news/delete', { method: 'POST', body: JSON.stringify({ ids }) });
                showToast('삭제 완료', `${ids.length}개`, { kind: 'success' });
                await Promise.all([loadNews(), loadDashboard()]);
              },
            });
            return;
          }
          if (target.id === 'refreshSelectedYoutubeBtn') {
            const ids = selectedYoutubeIds();
            openConfirm({
              title: '선택 갱신',
              desc: '선택한 유튜브 영상을 provider에서 다시 조회합니다.',
              body: `대상: ${ids.length}개`,
              okText: '갱신',
              danger: false,
              onConfirm: async () => {
                await api('/admin/api/youtube/refresh-selected', { method: 'POST', body: JSON.stringify({ ids }) });
                showToast('갱신 요청', `${ids.length}개`, { kind: 'success' });
                await Promise.all([loadYoutube(), loadJobRuns(), loadDashboard()]);
              },
            });
            return;
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
          if (target.id === 'resetSelectAllBtn') {
            document.querySelectorAll('[data-reset-target]').forEach((box) => { box.checked = true; });
            updateResetUi();
            return;
          }
          if (target.id === 'resetClearBtn') {
            document.querySelectorAll('[data-reset-target]').forEach((box) => { box.checked = false; });
            updateResetUi();
            return;
          }
          if (target.id === 'resetDataBtn') {
            const targets = [...document.querySelectorAll('[data-reset-target]')]
              .filter((box) => box.checked)
              .map((box) => box.dataset.resetTarget);
            const confirmText = $('resetConfirmText').value.trim();
            openConfirm({
              title: '데이터 초기화',
              desc: '이 작업은 되돌릴 수 없습니다.',
              body: `대상: ${targets.length ? targets.join(', ') : '(선택 없음)'}\n확인문구: ${confirmText || '(없음)'}`,
              okText: '초기화',
              danger: true,
              onConfirm: async () => {
                const body = { targets, confirmText };
                const result = await api('/admin/api/data-reset', { method: 'POST', body: JSON.stringify(body) });
                $('resetResult').textContent = `초기화 완료: ${result.data.targets.join(', ')}`;
                $('resetConfirmText').value = '';
                document.querySelectorAll('[data-reset-target]').forEach((box) => { box.checked = false; });
                updateResetUi();
                showToast('초기화 완료', result.data.targets.join(', '), { kind: 'success' });
                await Promise.all([loadDashboard(), loadJobs(), loadJobRuns(), loadNews(), loadYoutube()]);
              },
            });
            return;
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
          showToast('오류', error.message, { kind: 'error' });
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
          if (state.view === 'calendar') {
            renderAdminCalendarGrid();
            renderCalendarDayTable();
          }
        }
        if (event.target.id === 'adminTimeBasis') {
          localStorage.setItem('signalAdminTimeBasis', event.target.value);
          await Promise.all([loadDashboard(), loadJobs(), loadJobRuns(), loadNews(), loadYoutube()]);
        }
        if (event.target.dataset && event.target.dataset.newsSourceEnabled) {
          const id = event.target.dataset.newsSourceEnabled;
          const hit = (state.newsSources || []).find((s) => s.id === id);
          if (hit) {
            hit.enabled = !!event.target.checked;
            renderNewsSources();
          }
        }
        if (event.target.id === 'newsSourcesShowHidden') {
          state.newsSourcesShowHidden = !!event.target.checked;
          await loadNewsSources();
        }
        // category is managed via tabs in the News Sources section
        if (event.target.id === 'globalSearchQuery') {
          if ($('globalSearchResults')) $('globalSearchResults').innerHTML = renderSearchResults(event.target.value);
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
        if (event.target.id === 'monitoringSort') {
          state.monitoringSort = event.target.value || 'newest';
          await loadMonitoring();
        }
        if (event.target.id === 'jobListEnabled') {
          state.jobListEnabled = event.target.value || 'all';
          await loadJobs();
        }
        if (event.target.id === 'jobListDomain') {
          state.jobListDomain = event.target.value || 'all';
          await loadJobs();
        }
        if (event.target.id === 'jobListProvider') {
          state.jobListProvider = event.target.value || 'all';
          await loadJobs();
        }
        if (event.target.id === 'jobListSort') {
          state.jobListSort = event.target.value || 'name';
          await loadJobs();
        }
        if (event.target.id === 'jobRunsSelectAll') {
          const checked = !!event.target.checked;
          const keys = [...document.querySelectorAll('[data-job-run-select]')]
            .map((el) => el.dataset.jobRunSelect)
            .filter(Boolean);
          state.jobRunsSelected = checked ? [...new Set(keys)] : [];
          await loadJobRuns();
        }
        if (event.target.dataset.jobRunSelect) {
          const key = event.target.dataset.jobRunSelect;
          const selected = new Set(state.jobRunsSelected || []);
          if (event.target.checked) selected.add(key);
          else selected.delete(key);
          state.jobRunsSelected = [...selected];
          await loadJobRuns();
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
        if (event.target.id === 'calendarMonthPick') {
          state.calendarMonthYm = event.target.value;
          state.calendarSelectedYmd = '';
          await loadCalendar();
        }
        if (event.target.id === 'marketListAddSymbol' && event.target.value.includes(',')) {
          event.target.value = event.target.value.replaceAll(',', ' ');
        }
        if (event.target.dataset.newsId) updateNewsSelectionInfo();
        if (event.target.dataset.youtubeId) updateYoutubeSelectionInfo();
        if (event.target.dataset.resetTarget) updateResetUi();
      });

      document.addEventListener('input', (event) => {
        if (event.target.id === 'resetConfirmText') updateResetUi();
      });

      document.addEventListener('keydown', async (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          buildSearchIndex();
          if ($('globalSearchQuery')) $('globalSearchQuery').value = '';
          if ($('globalSearchResults')) $('globalSearchResults').innerHTML = renderSearchResults('');
          openPanel('globalSearchPanel');
          setTimeout(() => $('globalSearchQuery')?.focus(), 0);
        }
        if (event.key === 'Escape') {
          document.body.classList.remove('sideOpen');
          if ($('sideOverlay')) $('sideOverlay').classList.add('hidden');
          if (isPanelOpen('globalSearchPanel')) closePanel('globalSearchPanel');
          if (isPanelOpen('notifPanel')) closePanel('notifPanel');
          if (isPanelOpen('profileMenu')) closePanel('profileMenu');
          if (confirmState.open) closeConfirm();
        }
        if (event.key === 'Escape' && state.marketListDraft) {
          closeMarketListDialog();
        }
        if (event.key === 'Escape' && state.newsSourceAliasDraft) {
          closeNewsSourceAliasDialog();
        }
        if (event.key === 'Enter' && event.target.id === 'marketListAddSymbol') {
          event.preventDefault();
          document.getElementById('addMarketListSymbol')?.click();
        }
        if (event.key === 'Enter' && event.target.id === 'newsSourceAliasAdd') {
          event.preventDefault();
          document.getElementById('addNewsSourceAlias')?.click();
        }
        if (event.key === 'Enter' && event.target.id === 'jobListQuery') {
          event.preventDefault();
          state.jobListQuery = $('jobListQuery')?.value || '';
          await loadJobs();
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
      updateResetUi();
      // Keep settings tab stable across refreshes
      if ($('settingsTab-keys')) setSettingsTab(state.settingsTab || 'keys');
