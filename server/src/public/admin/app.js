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

      function defaultModelForProvider(provider, providerSettings = state.providerSettings) {
        const p = String(provider || '').trim().toLowerCase();
        const configured = (providerSettings || []).find((x) => x.provider === p)?.defaultModel || '';
        const presets = modelPresetsForProvider(p, configured);
        return configured || presets[0] || '';
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

      const newsEditLocales = [
        { locale: 'en', labelKey: 'localeOriginalEnglish' },
        { locale: 'ko', labelKey: 'localeKorean' },
        { locale: 'ja', labelKey: 'localeJapanese' },
      ];

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

      function allVisibleRunRows() {
        return [
          ...(state.jobRunsLastRows || []),
          ...(state.errorRows || []),
        ];
      }

      function runRowByKey(key) {
        const wanted = String(key || '');
        return allVisibleRunRows().find((run) => jobRunRowSelectKey(run) === wanted) || null;
      }

      function runErrorButton(run) {
        if (!run?.errorMessage) return `<span class="muted">-</span>`;
        return `<button class="secondary compactBtn" data-error-detail="${esc(jobRunRowSelectKey(run))}">${esc(textFor('btnErrorDetail'))}</button>`;
      }

      function openErrorDetailDialog(key) {
        const run = runRowByKey(key);
        if (!run) return;
        $('errorDetailDialog').classList.remove('hidden');
        $('errorDetailDialogTitle').textContent = textFor('errorDetailTitle');
        $('errorDetailDialogMeta').textContent = textForVars('errorDetailMeta', {
          job: run.displayName || run.jobKey || '-',
          status: run.status || '-',
          time: formatDateTime(run.finishedAt || run.startedAt),
        });
        $('errorDetailDialogBody').innerHTML = `
          <div class="errorDetailBody">
            <section class="errorDetailSection">
              <div class="cardKicker">${esc(textFor('errorDetailMessage'))}</div>
              <pre class="errorDetailMessage">${esc(run.errorMessage || '-')}</pre>
            </section>
            <section class="errorDetailSection">
              <div class="cardKicker">${esc(textFor('errorDetailContext'))}</div>
              <div class="errorDetailGrid">
                <span>${esc(textFor('colJob'))}</span><strong>${esc(run.displayName || run.jobKey || '-')}</strong>
                <span>jobKey</span><code>${esc(run.jobKey || '-')}</code>
                <span>${esc(textFor('colOperation'))}</span><div>${operationBadge(run.operation)}</div>
                <span>${esc(textFor('colDomain'))}</span><div>${domainBadge(run.domain || run.resultKind)}</div>
                <span>${esc(textFor('colProvider'))}</span><div>${providerBadge(run.provider)}</div>
                <span>${esc(textFor('colTrigger'))}</span><strong>${esc(run.trigger || '-')}</strong>
                <span>${esc(textFor('colItems'))}</span><strong>${esc(run.itemCount ?? 0)}</strong>
                <span>${esc(textFor('colDuration'))}</span><strong>${esc(formatDuration(run.durationMs))}</strong>
                <span>${esc(textFor('colStarted'))}</span><strong>${esc(formatDateTime(run.startedAt))}</strong>
                <span>${esc(textFor('colFinished'))}</span><strong>${esc(formatDateTime(run.finishedAt))}</strong>
              </div>
            </section>
          </div>
        `;
      }

      function closeErrorDetailDialog() {
        $('errorDetailDialog')?.classList.add('hidden');
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
                ? textFor('settingsThemeTitle')
                : settingsTabFromView === 'lists'
                  ? textFor('settingsListsTitle')
                  : settingsTabFromView === 'sources'
                    ? textFor('settingsSourcesTitle')
                    : settingsTabFromView === 'danger'
                      ? textFor('settingsDangerTitle')
                      : textFor('navSettingsKeys');
          }
          const desc = $('settingsDesc');
          if (desc) {
            desc.textContent =
              settingsTabFromView === 'theme'
                ? textFor('settingsThemeDesc')
                : settingsTabFromView === 'lists'
                  ? textFor('settingsListsDesc')
                  : settingsTabFromView === 'sources'
                    ? textFor('settingsSourcesDesc')
                    : settingsTabFromView === 'danger'
                      ? textFor('settingsDangerDesc')
                      : textFor('settingsProviderDesc');
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

      function setNewsMode(mode) {
        const m = mode === 'bulk' ? 'bulk' : 'filter';
        state.newsMode = m;
        document.querySelectorAll('[data-news-mode]').forEach((btn) => btn.classList.toggle('active', btn.dataset.newsMode === m));
        $('newsFilterBox')?.classList.toggle('hidden', m !== 'filter');
        $('newsBulkBox')?.classList.toggle('hidden', m !== 'bulk');
      }

      function setYoutubeMode(mode) {
        const m = mode === 'bulk' ? 'bulk' : 'filter';
        state.youtubeMode = m;
        document.querySelectorAll('[data-youtube-mode]').forEach((btn) => btn.classList.toggle('active', btn.dataset.youtubeMode === m));
        $('youtubeFilterBox')?.classList.toggle('hidden', m !== 'filter');
        $('youtubeBulkBox')?.classList.toggle('hidden', m !== 'bulk');
      }

      /**
       * Re-fetch and re-render all main admin panels. innerHTML views use textFor() at render time,
       * so they must run again after signalAdminLanguage changes (applyAdminLanguage alone is not enough).
       */
      async function reloadAllAdminData() {
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
        buildSearchIndex();
        const gsq = $('globalSearchQuery');
        const gsr = $('globalSearchResults');
        if (gsq instanceof HTMLInputElement && gsq.value && gsr) {
          gsr.innerHTML = renderSearchResults(gsq.value);
        }
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
          await reloadAllAdminData();
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
              ? `<div class="muted">${esc(textFor('notifEmpty'))}</div>`
              : `
                ${failed.length ? `<div class="card"><strong>${esc(textFor('notifFailed'))}</strong><div class="muted" style="margin-top:6px">${failed.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
                ${stale.length ? `<div class="card"><strong>${esc(textFor('notifStaleLabel'))}</strong><div class="muted" style="margin-top:6px">${stale.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
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
        if (!query) return `<div class="muted">${esc(textFor('searchPrompt'))}</div>`;
        const hits = (searchIndex.items || [])
          .map((it, index) => ({ it, index }))
          .filter(({ it }) => `${it.label} ${it.detail}`.toLowerCase().includes(query))
          .slice(0, 24);
        if (hits.length === 0) return `<div class="muted">${esc(textFor('searchNoHits'))}</div>`;
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
        state.errorRows = filtered;
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
                  <tr>
                    <th>${esc(textFor('colJob'))}</th>
                    <th>${esc(textFor('colStatus'))}</th>
                    <th>${esc(textFor('colRunInfo'))}</th>
                    <th>${esc(textFor('colTiming'))}</th>
                    <th class="center">${esc(textFor('colAction'))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map((run) => `
                    <tr>
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
                  `).join('')}
                </tbody>
              </table>
            `);
      }

      async function loadDashboard() {
        const summary = (await api('/admin/api/summary')).data;
        const allRuns = Array.isArray(summary.recentRuns) ? summary.recentRuns : [];
        const latestNews = Array.isArray(summary.latestNews) ? summary.latestNews : [];
        const latestYoutube = Array.isArray(summary.latestYoutube) ? summary.latestYoutube : [];
        const limit = Math.max(3, Math.min(10, Number(state.dashboardLimit) || 5));
        const op = state.dashboardOperationFilter === 'reconcile' ? 'reconcile' : 'latest';
        const opFiltered = allRuns.filter((r) => (r.operation || 'latest') === op);
        const sorted = [...opFiltered]
          .sort((a, b) => new Date(b.finishedAt || b.startedAt || 0).getTime() - new Date(a.finishedAt || a.startedAt || 0).getTime())
          .slice(0, limit);
        const staleCount = allRuns.filter((r) => r.stale).length;
        const failedCount = allRuns.filter((r) => String(r.status) === 'failed').length;
        const newsRows = latestNews.slice(0, limit);
        const youtubeRows = latestYoutube.slice(0, limit);
        $('dashboard').innerHTML = `
          <div class="statGrid wideStats">
            <div class="stat"><div class="statLabel muted"><span class="statIcon">N</span>${esc(textFor('statNews'))}</div><div class="statNum">${summary.counts.news}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">C</span>${esc(textFor('statCalendar'))}</div><div class="statNum">${summary.counts.calendar}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">Y</span>${esc(textFor('statYoutube'))}</div><div class="statNum">${summary.counts.youtube}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">Q</span>${esc(textFor('statQuotes'))}</div><div class="statNum">${summary.counts.marketQuotes || 0}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">B</span>${esc(textFor('statCoins'))}</div><div class="statNum">${summary.counts.coinMarkets || 0}</div></div>
            <div class="stat"><div class="statLabel muted"><span class="statIcon">J</span>${esc(textFor('statActiveJobs'))}</div><div class="statNum">${summary.counts.enabledJobs}</div></div>
          </div>
          <div class="dashboardToolbar">
            <div>
              <div class="cardKicker">${esc(textFor('dashboardOverviewTitle'))}</div>
              <div class="cardHint">${esc(textForVars('dashboardOverviewHint', { count: String(limit) }))}</div>
            </div>
            <label class="fieldLabel dashboardLimit">${esc(textFor('dashboardLimitLabel'))}
              <select id="dashboardLimit">
                ${[3, 5, 10].map((n) => `<option value="${n}" ${limit === n ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="dashboardGrid">
            <section class="card card--elevated dashboardPanel">
              <div class="cardHead">
                <div class="cardHeadMain">
                  <div class="cardKicker">${esc(textFor('dashboardNewsTitle'))}</div>
                  <div class="cardHint">${esc(textFor('dashboardNewsHint'))}</div>
                </div>
                <button class="secondary" data-view="news">${esc(textFor('btnOpenList'))}</button>
              </div>
              <div class="dashboardList">
                ${newsRows.map((item) => `
                  <article class="dashboardListItem">
                    <div class="dashboardItemMain">
                      <div class="dashboardItemTitle">${esc(item.title || '-')}</div>
                      <div class="dashboardItemMeta">
                        <span>${esc(item.sourceName || '-')}</span>
                        <span>${esc(item.category || '-')}</span>
                        <span>${esc(formatDateTime(item.publishedAt))}</span>
                      </div>
                    </div>
                    <button class="secondary compactBtn" data-dashboard-news-title="${esc(item.title || '')}">${esc(textFor('btnDetail'))}</button>
                  </article>
                `).join('') || `<p class="muted">${esc(textFor('dashboardEmpty'))}</p>`}
              </div>
            </section>
            <section class="card card--elevated dashboardPanel">
              <div class="cardHead">
                <div class="cardHeadMain">
                  <div class="cardKicker">${esc(textFor('dashboardYoutubeTitle'))}</div>
                  <div class="cardHint">${esc(textFor('dashboardYoutubeHint'))}</div>
                </div>
                <button class="secondary" data-view="youtube">${esc(textFor('btnOpenList'))}</button>
              </div>
              <div class="dashboardList">
                ${youtubeRows.map((item) => `
                  <article class="dashboardListItem dashboardListItem--media">
                    <img src="${esc(item.thumbnailUrl || '')}" alt="" />
                    <div class="dashboardItemMain">
                      <div class="dashboardItemTitle">${esc(item.title || '-')}</div>
                      <div class="dashboardItemMeta">
                        <span>${esc(item.channel || '-')}</span>
                        <span>${Number(item.viewCount || 0).toLocaleString()} views</span>
                        <span>${esc(formatDateTime(item.publishedAt))}</span>
                      </div>
                    </div>
                    <button class="secondary compactBtn" data-dashboard-youtube-title="${esc(item.title || '')}">${esc(textFor('btnDetail'))}</button>
                  </article>
                `).join('') || `<p class="muted">${esc(textFor('dashboardEmpty'))}</p>`}
              </div>
            </section>
          </div>
          <div class="card card--elevated dashboardPanel" style="margin-top:12px">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('dashboardJobsTitle'))}</div>
                <div class="cardHint"></div>
              </div>
              <div class="cardHeadActions">
                <div class="dashboardJobsHint">${esc(textForVars('dashboardJobsHint', { failed: String(failedCount), stale: String(staleCount) }))}</div>
                <div class="tabs" style="margin:0">
                  <button class="tabBtn ${op === 'latest' ? 'active' : ''}" data-dashboard-op="latest">${esc(textFor('tabLatest'))}</button>
                  <button class="tabBtn ${op === 'reconcile' ? 'active' : ''}" data-dashboard-op="reconcile">${esc(textFor('tabReconcile'))}</button>
                </div>
              </div>
            </div>
            <table class="settingsTable dashboardRunsTable">
              <thead>
                <tr>
                  <th>${esc(textFor('colJob'))}</th>
                  <th>${esc(textFor('colStatus'))}</th>
                  <th>${esc(textFor('colRunInfo'))}</th>
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
                    <td>
                      <div class="runMetaStack">
                        ${operationBadge(run.operation)}
                        ${domainBadge(run.domain || run.resultKind)}
                        ${providerBadge(run.provider)}
                      </div>
                    </td>
                    <td class="right">${run.itemCount ?? 0}</td>
                    <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
                    <td class="center">
                      <div class="dataTableActions">
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
          $('jobRunJob').innerHTML = `<option value="">${esc(textFor('jobListAllJobsOption'))}</option>` + body.data.map((job) => `
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
            <div class="filterBarTitle filterBoxTitle">${esc(textFor('filterSearchConditions'))}</div>
            <div class="filterBarControls toolbar">
              <div class="tabs" style="margin:0">
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
              <input id="jobListQuery" class="wide" placeholder="${esc(textFor('jobListQueryPlaceholder'))}" value="${esc(state.jobListQuery)}" />
              <select id="jobListSort">
                <option value="name" ${state.jobListSort === 'name' ? 'selected' : ''}>${esc(textFor('jobListSortName'))}</option>
                <option value="lastRunDesc" ${state.jobListSort === 'lastRunDesc' ? 'selected' : ''}>${esc(textFor('jobListSortLastRun'))}</option>
                <option value="intervalAsc" ${state.jobListSort === 'intervalAsc' ? 'selected' : ''}>${esc(textFor('jobListSortInterval'))}</option>
              </select>
              <button class="secondary" id="jobListReset">${esc(textFor('btnResetQuery'))}</button>
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
                        <div class="row" style="justify-content:space-between">
                          <strong>${esc(textFor('jobEditPanelTitle'))}</strong>
                          <button class="secondary" data-job-edit-close="${esc(job.jobKey)}">${esc(textFor('btnClose'))}</button>
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
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${jobsFiltered.length === 0 ? `<p class="muted">${esc(textFor('jobsEmptyFiltered'))}</p>` : ''}
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
          <div class="muted">${esc(textForVars('pagerSummary', { total: state.jobRunsTotal, page: state.jobRunsPage, pages: state.jobRunsTotalPages }))}</div>
          <div class="row">
            <button class="secondary" data-job-runs-page="prev">${esc(textFor('btnPrevious'))}</button>
            <button class="secondary" data-job-runs-page="next">${esc(textFor('btnNext'))}</button>
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
        if ($('jobRuns')) $('jobRuns').innerHTML = renderTableSkeleton({ cols: 10, rows: 5 });
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
          $('jobRuns').innerHTML = `<p class="muted">${esc(textFor('jobRunsEmptyMessage'))}</p>`;
          return;
        }

        $('jobRuns').innerHTML = `
          ${selected.size ? `
            <div class="actionBox" style="margin-bottom:10px">
              <span class="muted">${esc(textForVars('jobRunsSelectedLabel', { count: selected.size }))}</span>
              <div class="row">
                <button class="warning" id="jobRunsBulkRetry">${esc(textFor('jobRunsBulkRetry'))}</button>
                <button class="secondary" id="jobRunsBulkClear">${esc(textFor('jobRunsBulkClearSelection'))}</button>
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
                <th data-run-sort="progress">${esc(textFor('colProgress'))}</th>
                <th data-run-sort="items" class="right">${esc(textFor('colItems'))}</th>
                <th data-run-sort="duration" class="right">${esc(textFor('colDuration'))}</th>
                <th data-run-sort="finishedAt">${esc(textFor('colFinished'))}</th>
                <th class="center">${esc(textFor('colAction'))}</th>
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
                  <td class="muted">${formatDateTime(run.finishedAt || run.startedAt)}</td>
                  <td class="center">${runErrorButton(run)}</td>
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
          <div class="modelPresetPanel">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('modelPresetTitle'))}</div>
                <div class="cardHint">${esc(textFor('modelPresetHint'))}</div>
              </div>
              <span class="muted" id="uiModelPresetsStatus"></span>
            </div>
            <div class="modelPresetGrid">
              <label class="fieldLabel modelPresetCard">OpenAI
                <textarea id="uiPresetOpenai" class="jsonEditor">${esc(presetsTextareaValue('openai'))}</textarea>
              </label>
              <label class="fieldLabel modelPresetCard">Claude
                <textarea id="uiPresetClaude" class="jsonEditor">${esc(presetsTextareaValue('claude'))}</textarea>
              </label>
              <label class="fieldLabel modelPresetCard">Mock
                <textarea id="uiPresetMock" class="jsonEditor">${esc(presetsTextareaValue('mock'))}</textarea>
              </label>
            </div>
            <div class="modelPresetActions">
              <button id="saveUiModelPresets" class="success">Save</button>
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
        const modelLabelForProvider = (provider) => defaultModelForProvider(provider, providers) || textFor('providerDefaultModelNone');
        $('translationSettings').innerHTML = `
          <div class="settingsHero">
            <span class="settingsHeroIcon">G</span>
            <div>
              <div class="cardKicker">${esc(textFor('translationPipelineTitle'))}</div>
              <p class="summary">${esc(textFor('translationPipelineHint'))}</p>
            </div>
          </div>
          <div class="card settingsControlCard">
            <div class="row" style="justify-content:space-between;gap:10px">
              <div>
                <strong>${esc(textFor('translationFlowTitle'))}</strong>
                <div class="muted" style="margin-top:4px">${esc(textFor('translationFlowHint'))}</div>
                ${missingKeys.length ? `<div class="muted" style="margin-top:6px"><span class="pill opReconcile">${esc(textFor('providerMissingKeys'))}</span> ${esc(textForVars('providerMissingKeysHint', { providers: missingKeys.join(', ') }))}</div>` : ''}
              </div>
              <div class="row">
                <button class="secondary" data-view="settings-keys">${esc(textFor('translationProviderLink'))}</button>
              </div>
            </div>
          </div>
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('translationLocalePolicyTitle'))}</div>
                <div class="cardHint">${esc(textFor('translationLocalePolicyHint'))}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>${esc(textFor('colLocale'))}</th>
                  <th>${esc(textFor('colEnabled'))}</th>
                  <th>${esc(textFor('colAutoNews'))}</th>
                  <th>${esc(textFor('colProvider'))}</th>
                  <th>${esc(textFor('colModel'))}</th>
                  <th>${esc(textFor('btnSave'))}</th>
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
                    <td><span class="pill pill--subtle" data-ts-model-label="${esc(s.locale)}">${esc(modelLabelForProvider(s.provider))}</span></td>
                    <td><button data-ts-save="${esc(s.locale)}" class="success">Save</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('translationTestTitle'))}</div>
                <div class="cardHint">${esc(textFor('translationTestHint'))}</div>
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
              <button id="resetTranslationTestText" class="secondary">${esc(textFor('translationDefaultButton'))}</button>
              <button id="runTranslationTest">${esc(textFor('translationRunButton'))}</button>
            </div>
            <textarea id="translationTestText" style="margin-top:10px">${esc(textFor('translationDefaultText'))}</textarea>
            <div id="translationTestResult" class="summary"></div>
          </div>
        `;
        if (state.openModelPresetsOnTranslations) {
          void switchView('settings-keys');
          state.openModelPresetsOnTranslations = false;
        }

        // initialize model presets (provider → model list)
        refreshTranslationTestModels(providers);
        if ($('translationTestProvider')) {
          $('translationTestProvider').addEventListener('change', () => refreshTranslationTestModels(providers));
        }
      }

      async function loadProviderSettings() {
        const [body, presetsBody] = await Promise.all([
          api('/admin/api/provider-settings'),
          api('/admin/api/ui-model-presets'),
        ]);
        const rows = Array.isArray(body.data) ? body.data : [];
        state.providerSettings = rows;
        state.uiModelPresets = presetsBody.data || null;
        const llm = rows.filter((r) => r.provider === 'openai' || r.provider === 'claude');
        const data = rows.filter((r) => !(r.provider === 'openai' || r.provider === 'claude'));
        const renderRow = (s, { showModel }) => {
          const models = showModel ? modelPresetsForProvider(s.provider, s.defaultModel) : [];
          return `
            <div class="providerTile ${showModel ? 'providerTile--llm' : 'providerTile--data'}">
              <div class="providerTileHead">
                <span class="providerGlyph">${showModel ? 'AI' : 'API'}</span>
                <div class="providerTitle">
                  <strong>${esc(s.provider)}</strong>
                  <span class="muted">${esc(showModel ? textFor('providerLlmSubtitle') : textFor('providerDataSubtitle'))}</span>
                </div>
                <span class="pill ${s.hasApiKey ? 'pillStatus--ok' : 'pillStatus--warn'}">${esc(s.hasApiKey ? textForVars('providerConfigured', { key: s.maskedApiKey }) : textFor('providerKeyMissing'))}</span>
              </div>
              <div class="providerTileBody">
                <label class="switchRow providerSwitch">
                  <input class="switchInput" type="checkbox" data-provider-enabled="${esc(s.provider)}" ${s.enabled ? 'checked' : ''}/>
                  <span class="switchUi" aria-hidden="true"></span>
                  <span class="switchLabel">Enabled</span>
                </label>
                ${showModel ? `
                  <label class="fieldLabel providerModel">${esc(textFor('providerDefaultModel'))}
                    <select data-provider-model="${esc(s.provider)}">
                      <option value="">${esc(textFor('providerSelectModel'))}</option>
                      ${renderModelOptions(models, s.defaultModel || '')}
                    </select>
                  </label>
                ` : ''}
                <label class="fieldLabel providerKey">${esc(textFor('providerApiKey'))}
                  <input class="keyInput" data-provider-key="${esc(s.provider)}" type="password" placeholder="${esc(textFor('providerApiKeyPh'))}" />
                </label>
              </div>
              <div class="providerActions">
                <button data-provider-save="${esc(s.provider)}" class="success">${esc(textFor('btnSave'))}</button>
                <button data-provider-clear="${esc(s.provider)}" class="danger">${esc(textFor('providerDeleteKey'))}</button>
              </div>
            </div>
          `;
        };
        $('providerSettings').innerHTML = `
          <div class="settingsSectionGrid">
            <div class="card settingsControlCard">
              <div class="cardHead">
                <div class="cardHeadMain">
                  <div class="cardKicker">${esc(textFor('providerLlmTitle'))}</div>
                  <div class="cardHint">${esc(textFor('providerLlmHint'))}</div>
                </div>
              </div>
              <div class="providerTileGrid">
                ${llm.map((s) => renderRow(s, { showModel: true })).join('') || `<p class="muted">${esc(textFor('providerLlmEmpty'))}</p>`}
              </div>
              <div id="uiModelPresets"></div>
            </div>

            <div class="card settingsControlCard">
              <div class="cardHead">
                <div class="cardHeadMain">
                  <div class="cardKicker">${esc(textFor('providerDataTitle'))}</div>
                  <div class="cardHint">${esc(textFor('providerDataHint'))}</div>
                </div>
              </div>
              <div class="providerTileGrid">
                ${data.map((s) => renderRow(s, { showModel: false })).join('') || `<p class="muted">${esc(textFor('providerDataEmpty'))}</p>`}
              </div>
            </div>
          </div>
        `;
        renderUiModelPresetsEditor();
        if ($('uiModelPresetsStatus') && state.uiModelPresets?.updatedAt) {
          $('uiModelPresetsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.uiModelPresets.updatedAt) });
        }
      }

      async function loadMarketLists() {
        const body = await api('/admin/api/market-lists');
        state.marketLists = body.data;
        const lists = Array.isArray(body.data) ? body.data : [];
        $('marketLists').innerHTML = `
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('marketListsCardTitle'))}</div>
                <div class="cardHint">${esc(textFor('marketListsCardHint'))}</div>
              </div>
            </div>
            <div class="settingsSectionBody">
              ${lists.length === 0 ? `<p class="muted">${esc(textFor('marketListsEmpty'))}</p>` : lists.map((list) => `
                <div class="card marketListCard">
                  <div class="cardHead">
                    <div class="cardHeadMain">
                      <div><strong>${esc(list.displayName)}</strong></div>
                      <div class="summary">${esc(list.description || '')}</div>
                      <div class="marketListMetaRow">
                        <span class="pill pill--subtle">${esc(list.key)}</span>
                        <span class="pill">${esc(textForVars('marketListRowCount', { n: Number(list.count) || 0 }))}</span>
                        <span class="marketListMetaItem muted"><span class="marketListMetaLabel">${esc(textFor('marketListMetaUpdated'))}</span>${formatDateTime(list.updatedAt)}</span>
                      </div>
                    </div>
                    <div class="cardHeadActions">
                      <button data-market-list-open="${esc(list.key)}" class="secondary">${esc(textFor('marketListManage'))}</button>
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
        const draftRows = (Array.isArray(state.newsSourceDraftRows) && state.newsSourceDraftRows.length ? state.newsSourceDraftRows : ['']);
        host.innerHTML = `
          <div class="card settingsControlCard">
            <div class="cardHead">
              <div class="cardHeadMain">
                <div class="cardKicker">${esc(textFor('newsSourcesTitle'))}</div>
                <div class="cardHint">${esc(textFor('newsSourcesHint'))}</div>
              </div>
              <div class="cardHeadActions">
                <button class="secondary" id="refreshNewsSourcesBtn">${esc(textFor('btnRefresh'))}</button>
              </div>
            </div>
            <div class="newsSourcesWorkspace">
              <div class="newsSourcesMain">
                <div class="newsSourcesTable">
                  <div class="sourceListHead">
                    <div>
                      <div class="cardKicker">${esc(textFor('newsSourceListTitle'))}</div>
                      <div class="cardHint">${esc(textForVars('newsSourceListHint', { count: rows.length }))}</div>
                    </div>
                    <div class="tabs tabs--compact">
                      <button type="button" class="tabBtn ${cat === 'global' ? 'active' : ''}" data-news-sources-tab="global">${esc(textFor('newsSourcesCatGlobal'))}</button>
                      <button type="button" class="tabBtn ${cat === 'crypto' ? 'active' : ''}" data-news-sources-tab="crypto">${esc(textFor('newsSourcesCatCrypto'))}</button>
                    </div>
                  </div>
                  <div class="sourceControlBlock sourceControlBlock--wide sourcePolicyInline">
                    <div class="sourceControlLabel">${esc(textFor('newsSourcePolicyTitle'))}</div>
                    <div class="sourceSwitches">
                      <label class="switchRow">
                        <input class="switchInput" type="checkbox" id="newsSourcesAutoEnableGlobal" ${policy.global !== false ? 'checked' : ''} />
                        <span class="switchUi" aria-hidden="true"></span>
                        <span class="switchLabel">${esc(textFor('newsSourcesCatGlobal'))} · ${esc(textFor('newsSourcesAutoEnable'))}</span>
                      </label>
                      <label class="switchRow">
                        <input class="switchInput" type="checkbox" id="newsSourcesAutoEnableCrypto" ${policy.crypto !== false ? 'checked' : ''} />
                        <span class="switchUi" aria-hidden="true"></span>
                        <span class="switchLabel">${esc(textFor('newsSourcesCatCrypto'))} · ${esc(textFor('newsSourcesAutoEnable'))}</span>
                      </label>
                      <label class="switchRow">
                        <input class="switchInput" type="checkbox" id="newsSourcesShowHidden" ${state.newsSourcesShowHidden ? 'checked' : ''} />
                        <span class="switchUi" aria-hidden="true"></span>
                        <span class="switchLabel">${esc(textFor('newsSourcesShowHidden'))}</span>
                      </label>
                    </div>
                    <button class="secondary" id="saveNewsSourceSettingsBtn">${esc(textFor('btnSave'))}</button>
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
                            <button class="secondary compactBtn" data-news-source-alias-open="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>${esc(aliasCountFor(s.name) ? textForVars('newsSourceAliasButton', { count: `(${aliasCountFor(s.name)})` }) : textFor('newsSourcesAliasTitle'))}</button>
                            <button class="secondary compactBtn" data-news-source-toggle-hidden="${esc(s.id)}">${esc(s.hidden ? textFor('newsSourcesUnhide') : textFor('newsSourcesHide'))}</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                  ${rows.length === 0 ? `<p class="muted">${esc(textFor('newsSourcesEmpty'))}</p>` : ''}
                  <div class="sourceDraftPanel">
                    <div class="sourceDraftHead">
                      <div>
                        <div class="sourceControlLabel">${esc(textFor('newsSourceAddTitle'))}</div>
                        <div class="cardHint">${esc(textFor('newsSourceAddHint'))}</div>
                      </div>
                      <button class="iconBtn" id="addNewsSourceDraftRow" title="${esc(textFor('newsSourceAddTitle'))}">+</button>
                    </div>
                    <div class="sourceDraftRows">
                      ${draftRows.map((value, idx) => `
                        <div class="sourceDraftRow">
                          <span class="muted">${idx + 1}</span>
                          <input class="newsSourcesAddInput" data-news-source-draft-index="${idx}" placeholder="${esc(textFor('newsSourceAddPh'))}" value="${esc(value || '')}" />
                          <button class="danger compactBtn" data-news-source-draft-remove="${idx}" ${draftRows.length <= 1 ? 'disabled' : ''}>${esc(textFor('btnRemove'))}</button>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
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
        const patch = {
          autoEnableNewSources: {
            global: !!$('newsSourcesAutoEnableGlobal')?.checked,
            crypto: !!$('newsSourcesAutoEnableCrypto')?.checked,
          },
        };
        const body = await api('/admin/api/news-source-settings', { method: 'PATCH', body: JSON.stringify(patch) });
        state.newsSourceSettings = body.data || state.newsSourceSettings;
        showToast(textFor('toastSaved') || 'Saved', textFor('newsSourcePolicyTitle'), { kind: 'success' });
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
        $('newsSourceAliasDialogTitle').textContent = textForVars('newsSourceAliasTitleFull', { source: draft.sourceName });
        $('newsSourceAliasDialogMeta').textContent = textForVars('newsSourceAliasMeta', { category: draft.category });
        $('newsSourceAliasCount').textContent = textForVars('newsSourceAliasCount', { count: draft.aliases.length });
        $('newsSourceAliasRows').innerHTML = `
          <div class="aliasPolicyHint muted">
            ${esc(textFor('newsSourceAliasPolicy'))}
          </div>
          ${draft.aliases.map((a, idx) => `
          <div class="symbolRow">
            <div class="muted">${idx + 1}</div>
            <input class="readonlyInput" value="${esc(a)}" disabled />
            <button class="danger" data-news-source-alias-remove="${idx}">${esc(textFor('btnRemove'))}</button>
          </div>
        `).join('') || `<p class="muted">${esc(textFor('newsSourceAliasEmpty'))}</p>`}
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

      function syncNewsSourceDraftRows() {
        const inputs = [...document.querySelectorAll('[data-news-source-draft-index]')];
        if (!inputs.length) {
          state.newsSourceDraftRows = Array.isArray(state.newsSourceDraftRows) && state.newsSourceDraftRows.length
            ? state.newsSourceDraftRows
            : [''];
          return;
        }
        state.newsSourceDraftRows = inputs
          .sort((a, b) => Number(a.dataset.newsSourceDraftIndex) - Number(b.dataset.newsSourceDraftIndex))
          .map((input) => String(input.value || ''));
        if (!state.newsSourceDraftRows.length) state.newsSourceDraftRows = [''];
      }

      async function saveNewsSources() {
        const category = state.newsSourcesCategory || 'global';
        syncNewsSourceDraftRows();
        const next = [...(state.newsSources || [])]
          .map((s, idx) => ({
            id: String(s.id || '').trim(),
            name: String(s.name || '').trim(),
            category,
            enabled: s.enabled !== false,
            hidden: !!s.hidden,
            order: idx + 1,
          }))
          .filter((s) => s.id && s.name);
        const seenIds = new Set(next.map((s) => s.id));
        const seenNames = new Set(next.map((s) => s.name.trim().toLowerCase()));
        for (const rawName of state.newsSourceDraftRows || []) {
          const name = String(rawName || '').trim();
          if (!name) continue;
          const id = normalizeNewsSourceIdFromName(name);
          const lower = name.toLowerCase();
          if (seenIds.has(id) || seenNames.has(lower)) continue;
          next.push({ id, name, category, enabled: true, hidden: false, order: next.length + 1 });
          seenIds.add(id);
          seenNames.add(lower);
        }
        next.forEach((s, idx) => { s.order = idx + 1; });
        const body = await api('/admin/api/news-sources', { method: 'PUT', body: JSON.stringify({ category, items: next }) });
        state.newsSources = Array.isArray(body.data) ? body.data : next;
        state.newsSourceDraftRows = [''];
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
        $('marketListDialogTitle').textContent = textForVars('marketListEditTitle', { name: draft.displayName });
        $('marketListDialogMeta').textContent = textForVars('marketListEditMetaLine', { key: draft.key, time: formatDateTime(draft.updatedAt) });
        $('marketListDialogName').value = draft.displayName;
        $('marketListDialogDesc').value = draft.description || '';
        $('marketListDialogCount').textContent = textForVars('marketListSymbolTotal', { n: draft.symbols.length });
        $('marketListSymbolRows').innerHTML = draft.symbols.map((symbol, index) => `
          <div class="symbolRow">
            <span class="muted">${index + 1}</span>
            <input data-market-symbol-index="${index}" value="${esc(symbol)}" />
            <button class="danger" data-market-symbol-delete="${index}">${esc(textFor('btnDeleteRow'))}</button>
          </div>
        `).join('') || `<p class="muted">${esc(textFor('marketListSymbolsEmpty'))}</p>`;
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
          <div class="muted">${esc(textForVars('pagerSummary', { total: state.newsTotal, page: state.newsPage, pages: state.newsTotalPages }))}</div>
          <div class="row">
            <button class="secondary" data-page="prev">${esc(textFor('btnPrevious'))}</button>
            <button class="secondary" data-page="next">${esc(textFor('btnNext'))}</button>
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
          <div class="muted">${esc(textForVars('pagerSummary', { total: state.youtubeTotal, page: state.youtubePage, pages: state.youtubeTotalPages }))}</div>
          <div class="row">
            <button class="secondary" data-youtube-page="prev">${esc(textFor('btnPrevious'))}</button>
            <button class="secondary" data-youtube-page="next">${esc(textFor('btnNext'))}</button>
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
          $('youtubeChannel').innerHTML = `<option value="">${esc(textFor('youtubeAllChannels'))}</option>` + body.channels.map((channel) => `
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
                  <span class="pill">${Number(item.viewCount || 0).toLocaleString()} ${esc(textFor('colYoutubeViews'))}</span>
                  <span class="muted">${formatDateTime(item.publishedAt)}</span>
                </div>
                <div class="title">${esc(item.title || '-')}</div>
                <div class="summary">${esc(item.description || '')}</div>
                <div class="row" style="margin-top:8px">
                  <a class="developerLink" style="margin:0;padding:0;border:0" href="https://www.youtube.com/watch?v=${esc(item.videoId)}" target="_blank" rel="noreferrer">${esc(textFor('youtubeOpenOnYoutube'))}</a>
                </div>
              </div>
            </div>
          </div>
        `).join('') || `<p class="muted">${esc(textFor('youtubeEmptyFilter'))}</p>`;
        updateYoutubeSelectionInfo();
      }

      async function loadNews() {
        if ($('news')) $('news').innerHTML = renderTableSkeleton({ cols: 2, rows: 4 });
        const body = await api(`/admin/api/news?${newsQueryParams()}`);
        state.newsPage = body.page;
        state.newsTotalPages = body.totalPages;
        state.newsTotal = body.total;
        state.newsRows = Array.isArray(body.data) ? body.data : [];
        renderPager('newsPagerTop');
        renderPager('newsPagerBottom');
        $('news').innerHTML =
          state.newsRows.length === 0
            ? `<p class="muted">${esc(textFor('newsEmpty'))}</p>`
            : `
              <div class="card card--elevated">
                <div class="cardHead">
                  <div class="cardHeadMain">
                    <div class="cardKicker">${esc(textFor('pageNewsTitle'))}</div>
                    <div class="cardHint">${esc(textFor('newsListHint'))}</div>
                  </div>
                </div>
                <div class="newsTable">
                  <table class="newsTableTable">
                    <thead>
                      <tr>
                        <th style="width:34px"></th>
                        <th style="width:120px">${esc(textFor('newsColTime'))}</th>
                        <th style="width:110px">${esc(textFor('newsColSource'))}</th>
                        <th style="width:92px">${esc(textFor('colCategory'))}</th>
                        <th style="width:92px">${esc(textFor('newsColStatus'))}</th>
                        <th>${esc(textFor('colTitle'))}</th>
                        <th style="width:210px">${esc(textFor('colAction'))}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${state.newsRows
                        .map((item) => {
                          const title = String(item.originalTitle || item.title || '-');
                          const source = String(item.sourceName || '-');
                          const published = formatDateTime(item.publishedAt);
                          const category = String(item.category || '-');
                          const translations = Array.isArray(item.translations) ? item.translations : [];
                          const statusFor = (locale) => translations.find((t) => t.locale === locale)?.status || 'missing';
                          const provider = String(item.provider || '-');
                          return `
                            <tr class="newsRow" data-news-row="${esc(item.id)}">
                              <td><input type="checkbox" data-news-id="${esc(item.id)}" /></td>
                              <td class="muted">${esc(published)}</td>
                              <td><span class="pill">${esc(source)}</span></td>
                              <td><span class="pill">${esc(category)}</span></td>
                              <td>
                                <div class="newsStatusStack">
                                  <span class="pill pill--subtle">KO ${esc(statusFor('ko'))}</span>
                                  <span class="pill pill--subtle">JA ${esc(statusFor('ja'))}</span>
                                </div>
                              </td>
                              <td>
                                <div class="newsTitle">${esc(title)}</div>
                                <div class="newsMeta muted">${esc(provider)}</div>
                              </td>
                              <td class="tableActions">
                                <button class="secondary" data-news-edit="${esc(item.id)}">${esc(textFor('newsEdit'))}</button>
                                <a class="developerLink" href="${esc(item.sourceUrl || '#')}" target="_blank" rel="noreferrer">${esc(textFor('newsOriginal'))} ↗</a>
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

      function newsTranslationFor(item, locale) {
        return (Array.isArray(item?.translations) ? item.translations : []).find((t) => t.locale === locale) || {};
      }

      function newsEditValue(item, locale, field) {
        const tr = newsTranslationFor(item, locale);
        if (field === 'title') return tr.title || item.originalTitle || item.title || '';
        if (field === 'summary') return tr.summary || item.originalSummary || item.summary || '';
        return '';
      }

      function closeNewsEditDialog() {
        state.newsEditItemId = '';
        state.newsEditLocale = 'en';
        if ($('newsEditDialog')) $('newsEditDialog').classList.add('hidden');
      }

      function renderNewsEditDialog() {
        const item = (state.newsRows || []).find((row) => String(row.id) === String(state.newsEditItemId));
        if (!item) {
          closeNewsEditDialog();
          return;
        }
        const locale = state.newsEditLocale || 'en';
        const tr = newsTranslationFor(item, locale);
        const titleValue = newsEditValue(item, locale, 'title');
        const summaryValue = newsEditValue(item, locale, 'summary');
        $('newsEditDialog').classList.remove('hidden');
        $('newsEditDialogTitle').textContent = textFor('newsEditDialogTitle');
        $('newsEditDialogMeta').textContent = `${item.sourceName || '-'} · ${formatDateTime(item.publishedAt)} · ${item.category || '-'}`;
        $('newsEditDialogStatus').textContent = `${locale.toUpperCase()} · ${tr.status || (locale === 'en' ? 'original' : 'missing')}`;
        $('newsEditDialogBody').innerHTML = `
          <div class="newsEditModal">
            <div class="tabs newsEditTabs" role="tablist">
              ${newsEditLocales.map((entry) => `
                <button
                  type="button"
                  class="tabBtn ${entry.locale === locale ? 'active' : ''}"
                  data-news-edit-locale="${esc(entry.locale)}">
                  ${esc(textFor(entry.labelKey))}
                </button>
              `).join('')}
            </div>
            <div class="newsEditSource">
              <div class="newsEditSourceTitle">${esc(item.originalTitle || item.title || '-')}</div>
              <div class="newsMeta muted">
                ${item.sourceUrl ? `<a class="developerLink" href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">${esc(textFor('newsOpenOriginal'))}</a>` : ''}
              </div>
            </div>
            <div class="newsEditGrid">
              <label class="fieldLabel">
                <span>Title</span>
                <textarea id="newsEditTitleInput" class="jsonEditor">${esc(titleValue)}</textarea>
              </label>
              <label class="fieldLabel">
                <span>Summary</span>
                <textarea id="newsEditSummaryInput" class="jsonEditor">${esc(summaryValue)}</textarea>
              </label>
            </div>
          </div>
        `;
      }

      function openNewsEditDialog(id) {
        state.newsEditItemId = String(id || '');
        state.newsEditLocale = 'en';
        renderNewsEditDialog();
      }

      function selectedNewsIds() {
        return [...document.querySelectorAll('[data-news-id]')].filter((box) => box.checked).map((box) => box.dataset.newsId);
      }

      function updateNewsSelectionInfo() {
        const total = document.querySelectorAll('[data-news-id]').length;
        const selected = selectedNewsIds().length;
        if ($('newsSelectionInfo')) $('newsSelectionInfo').textContent = textForVars('newsSelectedCount', { count: selected });
        if ($('selectPageBtn')) $('selectPageBtn').textContent = selected === total && total > 0 ? textFor('newsSelectPageClear') : textFor('newsSelectPage');
        if ($('retranslateSelectedBtn')) $('retranslateSelectedBtn').disabled = selected === 0;
        if ($('deleteSelectedNewsBtn')) $('deleteSelectedNewsBtn').disabled = selected === 0;
      }

      function selectedYoutubeIds() {
        return [...document.querySelectorAll('[data-youtube-id]')].filter((box) => box.checked).map((box) => box.dataset.youtubeId);
      }

      function updateYoutubeSelectionInfo() {
        const total = document.querySelectorAll('[data-youtube-id]').length;
        const selected = selectedYoutubeIds().length;
        if ($('youtubeSelectionInfo')) $('youtubeSelectionInfo').textContent = textForVars('youtubeSelectedCount', { count: selected });
        if ($('selectYoutubePageBtn')) $('selectYoutubePageBtn').textContent = selected === total && total > 0 ? textFor('youtubeSelectPageClear') : textFor('youtubeSelectPage');
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
        if ($('resetSelectionInfo')) $('resetSelectionInfo').textContent = textForVars('settingsResetSelectionCount', { n: selectedBoxes.length });
        if ($('resetSelectedList')) {
          $('resetSelectedList').textContent = selectedNames.length ? selectedNames.join(', ') : textFor('settingsResetSelectedNone');
        }
        if ($('resetDataBtn')) $('resetDataBtn').disabled = selectedBoxes.length === 0 || confirmText !== 'RESET';
      }

      document.addEventListener('click', async (event) => {
        const target = event.target;
        try {
          if (target?.dataset?.newsEdit) {
            openNewsEditDialog(target.dataset.newsEdit);
            return;
          }
          if (target?.dataset?.newsEditLocale) {
            state.newsEditLocale = target.dataset.newsEditLocale;
            renderNewsEditDialog();
            return;
          }
          if (target?.id === 'closeNewsEditDialog' || target?.id === 'cancelNewsEditDialog') {
            closeNewsEditDialog();
            return;
          }
          if (target?.id === 'newsEditDialog') {
            closeNewsEditDialog();
            return;
          }
          if (target?.dataset?.errorDetail) {
            openErrorDetailDialog(target.dataset.errorDetail);
            return;
          }
          if (target?.id === 'closeErrorDetailDialog' || target?.id === 'cancelErrorDetailDialog') {
            closeErrorDetailDialog();
            return;
          }
          if (target?.id === 'errorDetailDialog') {
            closeErrorDetailDialog();
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
            showToast(textFor('btnRefresh'), textFor('toastJobsLogsRefreshed'), { kind: 'info' });
            return;
          }
          if (target?.id === 'refreshNewsBtn') {
            await Promise.all([loadNews(), loadDashboard()]);
            showToast(textFor('btnRefresh'), textFor('btnRefreshThisView'), { kind: 'info' });
            return;
          }
          if (target?.id === 'refreshYoutubeBtn') {
            await Promise.all([loadYoutube(), loadDashboard()]);
            showToast(textFor('btnRefresh'), textFor('btnRefreshThisView'), { kind: 'info' });
            return;
          }
          if (target?.id === 'refreshSettingsBtn') {
            const tab = state.settingsTab || 'keys';
            if (tab === 'keys') await loadProviderSettings();
            else if (tab === 'lists') await loadMarketLists();
            else if (tab === 'sources') await Promise.all([loadNewsSourceSettings(), loadNewsSources()]);
            // theme/danger are mostly local UI; still refresh dashboard counts for safety
            await loadDashboard();
            showToast(textFor('btnRefresh'), textFor('btnRefreshThisView'), { kind: 'info' });
            return;
          }
          if (target?.id === 'refreshTranslationsBtn') {
            await Promise.all([loadTranslationSettings(), loadDashboard()]);
            showToast(textFor('btnRefresh'), textFor('btnRefreshThisView'), { kind: 'info' });
            return;
          }
          if (target?.id === 'refreshMonitoringBtn') {
            await loadMonitoring();
            showToast(textFor('btnRefresh'), textFor('toastMonitoringRefreshed'), { kind: 'info' });
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
              title: textFor('confirmJobRunsRetryTitle'),
              desc: textFor('confirmJobRunsRetryDesc'),
              body: textForVars('confirmJobRunsRetryBody', {
                runs: selectedRunKeys.length,
                jobs: jobKeys.length,
                keys: jobKeys.length ? jobKeys.join(', ') : textFor('confirmJobRunsRetryKeysNone'),
              }),
              okText: textFor('btnRetry'),
              danger: false,
              onConfirm: async () => {
                for (const key of jobKeys) {
                  await api(`/admin/api/jobs/${encodeURIComponent(key)}/run`, { method: 'POST' });
                }
                showToast(textFor('toastRetryRequested'), textForVars('toastRetryJobsRun', { count: jobKeys.length }), { kind: 'success' });
                state.jobRunsSelected = [];
                await Promise.all([loadJobRuns(), loadDashboard()]);
              },
            });
            return;
          }
          if (target?.id === 'headerHelpBtn') {
            showToast(
              textFor('ariaHelp'),
              textFor('helpToastContent'),
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
            showToast(textFor('toastMenuNotReadyTitle'), textFor('toastMenuNotReadyBody'));
            return;
          }
          if (target.dataset.openModelPresets) {
            await switchView('settings-keys');
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
          if (target?.dataset?.newsMode) {
            setNewsMode(target.dataset.newsMode);
            return;
          }
          if (target?.dataset?.youtubeMode) {
            setYoutubeMode(target.dataset.youtubeMode);
            return;
          }
          if (target.dataset.dashboardOp) {
            const next = target.dataset.dashboardOp === 'reconcile' ? 'reconcile' : 'latest';
            state.dashboardOperationFilter = next;
            await loadDashboard();
            return;
          }
          if (target.dataset.dashboardNewsTitle) {
            if ($('newsQuery')) $('newsQuery').value = target.dataset.dashboardNewsTitle || '';
            state.newsPage = 1;
            await switchView('news');
            await loadNews();
            return;
          }
          if (target.dataset.dashboardYoutubeTitle) {
            if ($('youtubeQuery')) $('youtubeQuery').value = target.dataset.dashboardYoutubeTitle || '';
            state.youtubePage = 1;
            await switchView('youtube');
            await loadYoutube();
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
            const provider = document.querySelector(`[data-ts-provider="${locale}"]`).value;
            await api(`/admin/api/translation-settings/${locale}`, {
              method: 'PATCH',
              body: JSON.stringify({
                enabled: document.querySelector(`[data-ts-enabled="${locale}"]`).checked,
                autoTranslateNews: document.querySelector(`[data-ts-auto="${locale}"]`).checked,
                provider,
              }),
            });
            await loadTranslationSettings();
          }
          if (target.dataset.providerSave) {
            const provider = target.dataset.providerSave;
            const apiKey = document.querySelector(`[data-provider-key="${provider}"]`).value.trim();
            const modelSelect = document.querySelector(`[data-provider-model="${provider}"]`);
            const body = {
              enabled: document.querySelector(`[data-provider-enabled="${provider}"]`).checked,
              apiKey,
            };
            if (modelSelect instanceof HTMLSelectElement) {
              body.defaultModel = modelSelect.value.trim();
            }
            await api(`/admin/api/provider-settings/${provider}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            });
            await loadProviderSettings();
          }
          if (target.dataset.providerClear) {
            const provider = target.dataset.providerClear;
            openConfirm({
              title: textFor('confirmProviderDeleteKeyTitle'),
              desc: textFor('confirmProviderDeleteKeyDesc'),
              body: textForVars('confirmProviderDeleteKeyBody', { provider }),
              okText: textFor('btnRemove'),
              danger: true,
              onConfirm: async () => {
                await api(`/admin/api/provider-settings/${provider}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ clearApiKey: true }),
                });
                showToast(textFor('toastProviderKeyRemoved'), provider, { kind: 'success' });
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
            if ($('uiModelPresetsStatus')) $('uiModelPresetsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.uiModelPresets?.updatedAt) });
            showToast(textFor('toastSaved'), textFor('modelPresetTitle'));
            if (state.view === 'settings-keys') {
              await loadProviderSettings();
            } else {
              await loadTranslationSettings();
            }
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
            state.newsSourceDraftRows = [''];
            await loadNewsSourceSettings();
            await loadNewsSources();
            return;
          }
          if (target.id === 'saveNewsSourceSettingsBtn') {
            await saveNewsSourceSettings();
            return;
          }
          if (target.id === 'addNewsSourceDraftRow') {
            syncNewsSourceDraftRows();
            state.newsSourceDraftRows.push('');
            renderNewsSources();
            return;
          }
          if (target.dataset.newsSourceDraftRemove) {
            syncNewsSourceDraftRows();
            const idx = Number(target.dataset.newsSourceDraftRemove);
            state.newsSourceDraftRows = (state.newsSourceDraftRows || []).filter((_, i) => i !== idx);
            if (!state.newsSourceDraftRows.length) state.newsSourceDraftRows = [''];
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
          if (target.id === 'saveNewsEditDialog') {
            const id = state.newsEditItemId;
            const locale = state.newsEditLocale || 'en';
            if (!id) return;
            await api(`/admin/api/news/${encodeURIComponent(id)}/translation/${locale}`, {
              method: 'PATCH',
              body: JSON.stringify({
                title: $('newsEditTitleInput').value,
                summary: $('newsEditSummaryInput').value,
              }),
            });
            showToast(textFor('toastSaved'), textForVars('newsEditSaved', { locale: locale.toUpperCase() }), { kind: 'success' });
            await loadNews();
            renderNewsEditDialog();
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
              title: textFor('confirmNewsRetranslateTitle'),
              desc: textFor('confirmNewsRetranslateDesc'),
              body: textForVars('confirmNewsRetranslateBody', { count: ids.length, locale }),
              okText: textFor('confirmOkTranslate'),
              danger: false,
              onConfirm: async () => {
                await api('/admin/api/news/retranslate', { method: 'POST', body: JSON.stringify({ ids, locale }) });
                showToast(textFor('toastTranslateRequested'), textForVars('toastItemCount', { count: ids.length }), { kind: 'success' });
                await loadNews();
              },
            });
            return;
          }
          if (target.id === 'deleteSelectedNewsBtn') {
            const ids = selectedNewsIds();
            if (ids.length === 0) return;
            openConfirm({
              title: textFor('confirmNewsDeleteTitle'),
              desc: textFor('confirmNewsDeleteDesc'),
              body: textForVars('confirmNewsDeleteBody', { count: ids.length }),
              okText: textFor('btnRemove'),
              danger: true,
              onConfirm: async () => {
                await api('/admin/api/news/delete', { method: 'POST', body: JSON.stringify({ ids }) });
                showToast(textFor('confirmNewsDeleteTitle'), textForVars('toastItemCount', { count: ids.length }), { kind: 'success' });
                await Promise.all([loadNews(), loadDashboard()]);
              },
            });
            return;
          }
          if (target.id === 'refreshSelectedYoutubeBtn') {
            const ids = selectedYoutubeIds();
            openConfirm({
              title: textFor('confirmYoutubeRefreshTitle'),
              desc: textFor('confirmYoutubeRefreshDesc'),
              body: textForVars('confirmYoutubeRefreshBody', { count: ids.length }),
              okText: textFor('confirmOkRefreshShort'),
              danger: false,
              onConfirm: async () => {
                await api('/admin/api/youtube/refresh-selected', { method: 'POST', body: JSON.stringify({ ids }) });
                showToast(textFor('toastRefreshRequested'), textForVars('toastItemCount', { count: ids.length }), { kind: 'success' });
                await Promise.all([loadYoutube(), loadJobRuns(), loadDashboard()]);
              },
            });
            return;
          }
          if (target.id === 'resetTranslationTestText') {
            $('translationTestText').value = textFor('translationDefaultText');
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
              title: textFor('confirmDataResetTitle'),
              desc: textFor('confirmDataResetDesc'),
              body: textForVars('confirmDataResetBody', {
                targets: targets.length ? targets.join(', ') : textFor('confirmDataResetTargetsNone'),
                confirm: confirmText || textFor('confirmDataResetConfirmNone'),
              }),
              okText: textFor('confirmOkResetShort'),
              danger: true,
              onConfirm: async () => {
                const body = { targets, confirmText };
                const result = await api('/admin/api/data-reset', { method: 'POST', body: JSON.stringify(body) });
                $('resetResult').textContent = `${textFor('toastDataResetDone')}: ${result.data.targets.join(', ')}`;
                $('resetConfirmText').value = '';
                document.querySelectorAll('[data-reset-target]').forEach((box) => { box.checked = false; });
                updateResetUi();
                showToast(textFor('toastDataResetDone'), textForVars('toastDataResetDoneDetail', { targets: result.data.targets.join(', ') }), { kind: 'success' });
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
          showToast(textFor('toastErrorTitle'), error.message, { kind: 'error' });
        }
      });

      document.addEventListener('change', async (event) => {
        // Provider changed in translation settings table → show the provider default model.
        if (event.target instanceof HTMLSelectElement && event.target.dataset.tsProvider) {
          const locale = event.target.dataset.tsProvider;
          const provider = event.target.value || 'mock';
          const label = document.querySelector(`[data-ts-model-label="${locale}"]`);
          if (label) label.textContent = defaultModelForProvider(provider) || textFor('providerDefaultModelNone');
        }
        if (event.target.id === 'adminLanguage') {
          localStorage.setItem('signalAdminLanguage', event.target.value);
          applyAdminLanguage();
          const adminOpen = $('adminPanel') && !$('adminPanel').classList.contains('hidden');
          if (adminOpen) {
            await reloadAllAdminData();
            await switchView(state.view || 'dashboard');
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
        if (event.target.id === 'dashboardLimit') {
          state.dashboardLimit = Number(event.target.value) || 5;
          localStorage.setItem('signalAdminDashboardLimit', String(state.dashboardLimit));
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
        if (event.target.dataset && event.target.dataset.newsSourceDraftIndex) syncNewsSourceDraftRows();
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
        if (event.key === 'Escape' && state.newsEditItemId) {
          closeNewsEditDialog();
        }
        if (event.key === 'Escape' && isPanelOpen('errorDetailDialog')) {
          closeErrorDetailDialog();
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
      state.dashboardLimit = Number(localStorage.getItem('signalAdminDashboardLimit') || '5') || 5;
      $('adminLanguage').value = localStorage.getItem('signalAdminLanguage') || 'ko';
      $('adminTimeBasis').value =
        localStorage.getItem('signalAdminTimeBasis') ||
        (localStorage.getItem('signalAdminTimeMode') === 'utc'
          ? 'utc|UTC'
          : `${localStorage.getItem('signalAdminLocale') || 'ko-KR'}|${localStorage.getItem('signalAdminLocale') === 'en-US' ? 'America/New_York' : localStorage.getItem('signalAdminLocale') === 'ja-JP' ? 'Asia/Tokyo' : 'Asia/Seoul'}`);
      applyAdminLanguage();
      setNewsMode(state.newsMode || 'filter');
      setYoutubeMode(state.youtubeMode || 'filter');
      updateNewsSelectionInfo();
      updateYoutubeSelectionInfo();
      refreshSession().catch((error) => { $('session').textContent = error.message; });
      updateResetUi();
      // Keep settings tab stable across refreshes
      if ($('settingsTab-keys')) setSettingsTab(state.settingsTab || 'keys');
