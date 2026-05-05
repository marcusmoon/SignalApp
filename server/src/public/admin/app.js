import { api } from './api.js';
import { esc, formatDateTime, jobIntervalLabel, timeBasis, ymd } from './format.js';
import { applyAdminLanguage, textFor, textForVars } from './i18n.js';
import { closeConfirm, confirmState, openConfirm } from './modal.js';
import { $, state } from './state.js';
import { applyTheme } from './theme.js';
import { dismissToast, showToast } from './toast.js';
import { loadDashboardView } from './views/dashboard.js';
import { loadInsightsView } from './views/insights.js';
import { loadJobsView, loadJobRunsView } from './views/jobs.js';
import { loadErrorsView, loadMonitoringView } from './views/monitoring.js';
import {
  closeNewsEditDialog as closeNewsEditDialogView,
  loadNewsView,
  loadYoutubeView,
  openNewsEditDialog as openNewsEditDialogView,
  renderNewsEditDialog as renderNewsEditDialogView,
  selectedNewsIds as selectedNewsIdsView,
  selectedYoutubeIds as selectedYoutubeIdsView,
  updateNewsSelectionInfo as updateNewsSelectionInfoView,
  updateYoutubeSelectionInfo as updateYoutubeSelectionInfoView,
} from './views/content.js';
import {
  defaultModelForProvider as defaultModelForProviderView,
  loadMarketListsView,
  modelPresetsForProvider as modelPresetsForProviderView,
  loadAdminUsersView,
  loadProviderSettingsView,
  loadTranslationSettingsView,
  loadUiModelPresetsView,
  refreshTranslationTestModels as refreshTranslationTestModelsView,
  renderUiModelPresetsEditorView,
} from './views/settings.js';
import {
  initCalendarMonthIfNeeded as initCalendarMonthIfNeededView,
  loadCalendarView,
  renderAdminCalendarGrid as renderAdminCalendarGridView,
  renderCalendarDayTable as renderCalendarDayTableView,
  shiftCalendarMonth as shiftCalendarMonthView,
} from './views/calendar.js';
import {
  closeNewsSourceAliasDialogView,
  loadNewsSourceSettingsView,
  loadNewsSourcesView,
  openNewsSourceAliasDialogView,
  renderNewsSourceAliasDialogView,
  renderNewsSourcesView,
  saveNewsSourceAliasesFromDialogView,
  saveNewsSourceSettingsView,
  saveNewsSourcesView,
} from './views/newsSources.js';
import {
  closeMarketListDialogView,
  openMarketListDialogView,
  renderMarketListDialogView,
  syncMarketListDraftFromInputsView,
} from './views/marketLists.js';
import { closeErrorDetailDialogView, openErrorDetailDialogView } from './views/dialogs.js';
import { buildSearchIndexView, createSearchIndex, renderSearchResultsView } from './views/search.js';

      function getUrlParam(key) {
        try {
          return new URLSearchParams(window.location.search).get(key);
        } catch {
          return null;
        }
      }

      function setUrlParam(key, value) {
        try {
          const url = new URL(window.location.href);
          if (value == null || value === '') url.searchParams.delete(key);
          else url.searchParams.set(key, String(value));
          window.history.replaceState({}, '', url.toString());
        } catch {
          // ignore
        }
      }

      /** Keep drawer `top` / `height` in sync when the header wraps on narrow viewports. */
      function initAdminHeaderHeightSync() {
        const el = document.querySelector('header');
        if (!el) return;
        const apply = () => {
          const h = Math.ceil(el.getBoundingClientRect().height);
          document.documentElement.style.setProperty('--admin-header-h', `${h}px`);
        };
        apply();
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => apply());
          ro.observe(el);
        } else {
          window.addEventListener('resize', apply);
        }
      }

      function updateMobileFilterToggle(bar) {
        const toggle = bar?.querySelector?.('[data-mobile-filter-toggle]');
        if (!toggle) return;
        const expanded = !bar.classList.contains('mobileFilterCollapsed');
        toggle.textContent = textFor(expanded ? 'mobileFilterClose' : 'mobileFilterOpen');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }

      function enhanceMobileAdminSurfaces(root = document) {
        const host = root && typeof root.querySelectorAll === 'function' ? root : document;
        host.querySelectorAll('.filterBar').forEach((bar) => {
          if (!bar.querySelector('.filterBarControls')) return;
          bar.classList.add('mobileFilterEnhanced');
          if (!bar.querySelector('[data-mobile-filter-toggle]')) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'secondary mobileFilterToggle';
            toggle.dataset.mobileFilterToggle = 'true';
            const title = bar.querySelector('.filterBarTitle, .filterBoxTitle');
            if (title) title.insertAdjacentElement('afterend', toggle);
            else bar.insertAdjacentElement('afterbegin', toggle);
            bar.classList.add('mobileFilterCollapsed');
          }
          updateMobileFilterToggle(bar);
        });
      }

      function initScrollTopButton() {
        const btn = $('scrollTopBtn');
        if (!btn) return;
        let ticking = false;
        const update = () => {
          ticking = false;
          document.body.classList.toggle('showScrollTop', window.scrollY > 420);
        };
        window.addEventListener(
          'scroll',
          () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
          },
          { passive: true },
        );
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        update();
      }

      function normalizeAdminLang(value) {
        const v = String(value || '').trim().toLowerCase();
        if (v === 'ko' || v === 'en' || v === 'ja') return v;
        return null;
      }

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

      function defaultModelForProvider(provider, providerSettings = state.providerSettings) {
        return defaultModelForProviderView({ provider, providerSettings, uiModelPresets: state.uiModelPresets });
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
        return refreshTranslationTestModelsView({ providerSettings, uiModelPresets: state.uiModelPresets, $, esc });
      }

      function setDatePresetFor(prefix) {
        const rangeEl = $(`${prefix}Range`);
        if (!rangeEl) return;
        const preset = rangeEl.value;
        const today = ymdInAdminTime(new Date());
        let from = '';
        let to = '';
        if (preset === 'today') from = to = today;
        if (preset === 'yesterday') {
          from = shiftYmd(today, -1);
          to = from;
        }
        if (preset === '7d') {
          from = shiftYmd(today, -6);
          to = today;
        }
        if (preset === '30d') {
          from = shiftYmd(today, -29);
          to = today;
        }
        if (preset !== 'custom') {
          $(`${prefix}From`).value = from;
          $(`${prefix}To`).value = to;
        }
      }

      function ymdInAdminTime(date) {
        const basis = timeBasis();
        if (basis.timeZone === 'UTC') return date.toISOString().slice(0, 10);
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: basis.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).formatToParts(date);
          const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
          if (byType.year && byType.month && byType.day) return `${byType.year}-${byType.month}-${byType.day}`;
        } catch {
          // Fall through to browser-local date.
        }
        return ymd(date);
      }

      function shiftYmd(value, days) {
        const [year, month, day] = String(value || '').split('-').map((part) => Number(part));
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
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

      function setInsightDatePreset() {
        setDatePresetFor('insight');
      }

      function applyInsightDatePresetToState() {
        const filters = state.insightFilters || {};
        const preset = filters.range || '7d';
        const today = ymdInAdminTime(new Date());
        let from = filters.from || '';
        let to = filters.to || '';
        if (preset === 'today') from = to = today;
        if (preset === '7d') {
          from = shiftYmd(today, -6);
          to = today;
        }
        if (preset === '30d') {
          from = shiftYmd(today, -29);
          to = today;
        }
        if (preset === 'all') {
          from = '';
          to = '';
        }
        state.insightFilters = { ...filters, range: preset, from, to };
      }

      function syncInsightFiltersFromDom() {
        state.insightFilters = {
          range: $('insightRange')?.value || state.insightFilters?.range || '7d',
          from: $('insightFrom')?.value || '',
          to: $('insightTo')?.value || '',
          kind: $('insightKind')?.value || '',
          level: $('insightLevel')?.value || '',
          push: $('insightPush')?.value || '',
          q: $('insightQuery')?.value || '',
          pageSize: $('insightPageSize')?.value || state.insightFilters?.pageSize || '30',
        };
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
                  : d === 'insights'
                    ? 'domainInsights'
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
        insights: 'I',
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
        const known = ['news', 'calendar', 'youtube', 'market', 'insights', 'other'].includes(d);
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
        return openErrorDetailDialogView({
          key,
          $,
          textFor,
          textForVars,
          esc,
          formatDateTime,
          formatDuration,
          runRowByKey,
          operationBadge,
          domainBadge,
          providerBadge,
        });
      }

      function closeErrorDetailDialog() {
        return closeErrorDetailDialogView({ $ });
      }


      async function switchView(view) {
        const requestedView = view;
        const settingsTabFromView =
          requestedView === 'settings-keys'
            ? 'keys'
            : requestedView === 'settings-theme'
              ? 'theme'
              : requestedView === 'settings-users'
                ? 'users'
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
        const resolvedRequestedView = panel ? requestedView : 'dashboard';
        state.view = resolvedRequestedView;
        setUrlParam('view', resolvedRequestedView);
        document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
        $(`view-${resolvedView}`)?.classList.remove('hidden');
        document.querySelectorAll('[data-view]').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.view === resolvedRequestedView);
          btn.classList.toggle('secondary', btn.dataset.view !== resolvedRequestedView);
        });

        // Lazy-load data for views that need it.
        if (resolvedView === 'calendar') void loadCalendar();
        if (resolvedView === 'monitoring') void loadMonitoring();
        if (resolvedView === 'errors') void loadErrors();
        if (resolvedView === 'insights') void loadInsights();
        if (resolvedView === 'settings') {
          const activeSettingsTab = settingsTabFromView || state.settingsTab || 'users';
          setSettingsTab(activeSettingsTab);
          const title = $('settingsTitle');
          if (title) {
            title.textContent =
              activeSettingsTab === 'theme'
                ? textFor('settingsThemeTitle')
                : activeSettingsTab === 'users'
                  ? textFor('settingsUsersTitle')
                : activeSettingsTab === 'lists'
                  ? textFor('settingsListsTitle')
                  : activeSettingsTab === 'sources'
                    ? textFor('settingsSourcesTitle')
                    : activeSettingsTab === 'danger'
                      ? textFor('settingsDangerTitle')
                      : textFor('navSettingsKeys');
          }
          const desc = $('settingsDesc');
          if (desc) {
            desc.textContent =
              activeSettingsTab === 'theme'
                ? textFor('settingsThemeDesc')
                : activeSettingsTab === 'users'
                  ? textFor('settingsUsersDesc')
                : activeSettingsTab === 'lists'
                  ? textFor('settingsListsDesc')
                  : activeSettingsTab === 'sources'
                    ? textFor('settingsSourcesDesc')
                    : activeSettingsTab === 'danger'
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
          loadInsights(),
          loadErrors(),
          loadJobs(),
          loadJobRuns(),
          loadTranslationSettings(),
          loadProviderSettings(),
          loadAdminUsers(),
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
        let loggedIn = false;
        let adminLabel = 'logout';
        try {
          const body = await api('/admin/api/session');
          loggedIn = !!body.adminId;
          adminLabel = loggedIn ? `${body.adminId}` : 'logout';
          $('session').textContent = adminLabel;
        } catch (e) {
          const msg = e && typeof e.message === 'string' ? e.message : 'session error';
          $('session').textContent = msg;
          loggedIn = false;
          adminLabel = 'guest';
        }
        const profileName = loggedIn ? adminLabel : 'guest';
        if ($('headerProfileName')) $('headerProfileName').textContent = profileName;
        if ($('profileMenuTitle')) $('profileMenuTitle').textContent = profileName;
        document.body.classList.toggle('loginMode', !loggedIn);
        $('loginPanel').classList.toggle('hidden', loggedIn);
        $('adminPanel').classList.toggle('hidden', !loggedIn);
        $('logoutBtn').classList.toggle('hidden', !loggedIn);
        const collapse = $('sideCollapseBtn');
        if (collapse) collapse.textContent = document.body.classList.contains('sideCollapsed') ? '▸' : '◂';
        if (loggedIn) {
          // Restore job tab from URL (?tab=info|runs)
          const urlParams = new URLSearchParams(window.location.search);
          const viewFromUrl = urlParams.get('view');
          if (viewFromUrl) state.view = viewFromUrl;
          const jobTabFromUrl = urlParams.get('tab');
          if (jobTabFromUrl === 'info' || jobTabFromUrl === 'runs') state.jobTab = jobTabFromUrl;
          const runSort = urlParams.get('runSort');
          const runDir = urlParams.get('runDir');
          if (runSort) state.jobRunsSortKey = runSort;
          if (runDir === 'asc' || runDir === 'desc') state.jobRunsSortDir = runDir;
          setDatePreset();
          setJobRunDatePreset();
          setCalendarDatePreset();
          try {
            await reloadAllAdminData();
            await switchView(state.view || 'dashboard');
          } catch (error) {
            console.error('[admin] initial data load failed', error);
            showToast(textFor('toastErrorTitle'), error?.message || 'initial data load failed', { kind: 'error' });
          }
        }
        document.body.classList.remove('sessionPending');
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
          const stuck = runs.filter((r) => r.stuck);
          const stale = runs.filter((r) => r.stale);
          const count = failed.length + stuck.length + stale.length;
          $('headerNotifBadge').textContent = String(count);
          $('headerNotifBadge').style.display = count > 0 ? '' : 'none';
          if ($('notifList')) {
            $('notifList').innerHTML = count === 0
              ? `<div class="muted">${esc(textFor('notifEmpty'))}</div>`
              : `
                ${failed.length ? `<div class="card"><strong>${esc(textFor('notifFailed'))}</strong><div class="muted" style="margin-top:6px">${failed.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
                ${stuck.length ? `<div class="card"><strong>${esc(textFor('notifStuckLabel'))}</strong><div class="muted" style="margin-top:6px">${stuck.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
                ${stale.length ? `<div class="card"><strong>${esc(textFor('notifStaleLabel'))}</strong><div class="muted" style="margin-top:6px">${stale.map((r) => esc(r.displayName || r.jobKey)).join('<br/>')}</div></div>` : ''}
              `;
          }
        } catch {
          $('headerNotifBadge').style.display = 'none';
        }
      }

      const searchIndex = createSearchIndex();
      function buildSearchIndex() {
        return buildSearchIndexView({ searchIndex, state, jobDisplayName, switchView, setJobTab });
      }

      function renderSearchResults(q) {
        return renderSearchResultsView({ q, searchIndex, esc, textFor });
      }

      function runButton(jobKey, label) {
        const lab = label == null ? textFor('btnNowRun') : label;
        const kind = lab === textFor('btnRetry') ? 'warning' : 'success';
        return `<button class="${kind}" data-job-run="${esc(jobKey)}">${esc(lab)}</button>`;
      }

      async function loadMonitoring() {
        return loadMonitoringView({
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
        });
      }

      async function loadErrors() {
        return loadErrorsView({
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
        });
      }

      async function loadDashboard() {
        const result = await loadDashboardView({
          api,
          $,
          state,
          esc,
          textFor,
          textForVars,
          formatDateTime,
          operationBadge,
          providerBadge,
          domainBadge,
          runStatusPill,
        });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadJobs() {
        const result = await loadJobsView({
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
        });
        enhanceMobileAdminSurfaces();
        return result;
      }

      function formatDuration(ms) {
        if (!Number.isFinite(Number(ms))) return '-';
        if (Number(ms) < 1000) return `${Number(ms)}ms`;
        return `${(Number(ms) / 1000).toFixed(1)}s`;
      }

      async function loadJobRuns() {
        const result = await loadJobRunsView({
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
        });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadUiModelPresets() {
        return loadUiModelPresetsView({ api, state, renderUiModelPresetsEditor });
      }

      function renderUiModelPresetsEditor() {
        return renderUiModelPresetsEditorView({ $, state, esc, textFor, textForVars, formatDateTime });
      }

      function parsePresetLines(value) {
        const raw = String(value || '')
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        return [...new Set(raw)];
      }

      async function loadTranslationSettings() {
        const result = await loadTranslationSettingsView({ api, $, state, esc, textFor, textForVars, formatDateTime, switchView });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadProviderSettings() {
        const result = await loadProviderSettingsView({
          api,
          $,
          state,
          esc,
          textFor,
          textForVars,
          formatDateTime,
          renderUiModelPresetsEditor,
        });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadAdminUsers() {
        const result = await loadAdminUsersView({ api, $, state, esc, textFor, textForVars, formatDateTime });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadMarketLists() {
        const result = await loadMarketListsView({ api, $, state, esc, textFor, textForVars, formatDateTime });
        enhanceMobileAdminSurfaces();
        return result;
      }

      function renderNewsSources() {
        return renderNewsSourcesView({ $, state, esc, textFor, textForVars });
      }

      async function loadNewsSources() {
        const result = await loadNewsSourcesView({ api, $, state, esc, textFor, textForVars });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadNewsSourceSettings() {
        return loadNewsSourceSettingsView({ api, $, state, esc, textFor, textForVars });
      }

      async function saveNewsSourceSettings() {
        return saveNewsSourceSettingsView({ api, $, state, esc, textFor, textForVars, showToast });
      }

      function closeNewsSourceAliasDialog() {
        return closeNewsSourceAliasDialogView({ state, $ });
      }

      function renderNewsSourceAliasDialog() {
        return renderNewsSourceAliasDialogView({ state, $, esc, textFor, textForVars });
      }

      function openNewsSourceAliasDialog(sourceId) {
        return openNewsSourceAliasDialogView({ sourceId, state, $, esc, textFor, textForVars });
      }

      async function saveNewsSourceAliasesFromDialog() {
        return saveNewsSourceAliasesFromDialogView({ api, $, state, esc, textFor, textForVars, showToast });
      }

      async function saveNewsSources() {
        return saveNewsSourcesView({ api, $, state, esc, textFor, textForVars, showToast });
      }

      function renderMarketListDialog() {
        return renderMarketListDialogView({ $, state, esc, textFor, textForVars, formatDateTime });
      }

      function openMarketListDialog(key) {
        return openMarketListDialogView({ key, $, state, esc, textFor, textForVars, formatDateTime });
      }

      function closeMarketListDialog() {
        return closeMarketListDialogView({ $, state, esc, textFor, textForVars, formatDateTime });
      }

      function syncMarketListDraftFromInputs() {
        return syncMarketListDraftFromInputsView({ state, $ });
      }

      function closeNewsEditDialog() {
        return closeNewsEditDialogView({ state, $ });
      }

      function renderNewsEditDialog() {
        return renderNewsEditDialogView({ state, $, esc, textFor, formatDateTime });
      }

      function openNewsEditDialog(id) {
        return openNewsEditDialogView({ id, state, $, esc, textFor, formatDateTime });
      }

      function selectedNewsIds() {
        return selectedNewsIdsView();
      }

      function updateNewsSelectionInfo() {
        return updateNewsSelectionInfoView({ $, textForVars, textFor });
      }

      function selectedYoutubeIds() {
        return selectedYoutubeIdsView();
      }

      function updateYoutubeSelectionInfo() {
        return updateYoutubeSelectionInfoView({ $, textForVars, textFor });
      }

      function shiftCalendarMonth(ym, delta) {
        return shiftCalendarMonthView(ym, delta);
      }

      function initCalendarMonthIfNeeded() {
        return initCalendarMonthIfNeededView({ state, ymd });
      }

      function renderAdminCalendarGrid() {
        return renderAdminCalendarGridView({ state, $, esc, textFor, ymd });
      }

      function renderCalendarDayTable() {
        return renderCalendarDayTableView({ state, $, esc, textFor, textForVars });
      }

      async function loadCalendar() {
        const result = await loadCalendarView({ api, $, state, esc, textFor, textForVars, ymd });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadYoutube() {
        const result = await loadYoutubeView({ api, $, state, esc, textFor, textForVars, renderTableSkeleton, formatDateTime });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadNews() {
        const result = await loadNewsView({ api, $, state, esc, textFor, textForVars, renderTableSkeleton, formatDateTime });
        enhanceMobileAdminSurfaces();
        return result;
      }

      async function loadInsights() {
        applyInsightDatePresetToState();
        const result = await loadInsightsView({ api, $, state, esc, textFor, textForVars, formatDateTime });
        setInsightDatePreset();
        enhanceMobileAdminSurfaces();
        return result;
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
          if (target?.dataset?.mobileFilterToggle) {
            const bar = target.closest('.filterBar');
            bar?.classList.toggle('mobileFilterCollapsed');
            updateMobileFilterToggle(bar);
            return;
          }
          const sideGutter = target?.closest?.('#sideGutter');
          const sideCollapseBtn = target?.closest?.('#sideCollapseBtn');
          if (sideGutter || sideCollapseBtn) {
            document.body.classList.toggle('sideCollapsed');
            const btn = $('sideCollapseBtn');
            if (btn) btn.textContent = document.body.classList.contains('sideCollapsed') ? '▸' : '◂';
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
          if (target?.id === 'headerSearchBtn') {
            if ($('globalSearchQuery')) $('globalSearchQuery').value = '';
            if ($('globalSearchResults')) $('globalSearchResults').innerHTML = renderSearchResults('');
            openPanel('globalSearchPanel');
            setTimeout(() => $('globalSearchQuery')?.focus(), 0);
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
          if (target?.id === 'refreshInsightsBtn') {
            await Promise.all([loadInsights(), loadDashboard()]);
            showToast(textFor('btnRefresh'), textFor('btnRefreshThisView'), { kind: 'info' });
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
            const tab = state.settingsTab || 'users';
            if (tab === 'keys') await loadProviderSettings();
            else if (tab === 'users') await loadAdminUsers();
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
            document.querySelectorAll(`[data-job-edit-row="${esc(key)}"]`).forEach((row) => row.classList.toggle('hidden'));
            return;
          }
          if (target?.dataset?.jobEditClose) {
            const key = target.dataset.jobEditClose;
            document.querySelectorAll(`[data-job-edit-row="${esc(key)}"]`).forEach((row) => row.classList.add('hidden'));
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
          if (target?.id === 'jobListSearch') {
            state.jobListQuery = $('jobListQuery')?.value || '';
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
          if (target.dataset.dashboardRunType) {
            await switchView('jobs');
            setJobTab('runs');
            if ($('jobRunRange')) $('jobRunRange').value = '7d';
            setJobRunDatePreset();
            if ($('jobRunType')) $('jobRunType').value = target.dataset.dashboardRunType;
            if ($('jobRunJob')) $('jobRunJob').value = '';
            state.jobRunsPage = 1;
            await loadJobRuns();
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
          if (target.dataset.dashboardInsightTitle) {
            state.insightFilters = {
              ...(state.insightFilters || {}),
              range: '30d',
              q: target.dataset.dashboardInsightTitle || '',
              pageSize: state.insightFilters?.pageSize || '30',
            };
            applyInsightDatePresetToState();
            state.insightsPage = 1;
            await switchView('insights');
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
          const viewTarget = target instanceof Element ? target.closest('[data-view]') : null;
          if (viewTarget?.dataset?.view) {
            await switchView(viewTarget.dataset.view);
            // Close sidebar overlay after navigation (tablet)
            if (document.body.classList.contains('sideOpen')) {
              document.body.classList.remove('sideOpen');
              $('sideOverlay')?.classList.add('hidden');
            }
          }
          const jobTabTarget = target instanceof Element ? target.closest('[data-job-tab]') : null;
          if (jobTabTarget?.dataset?.jobTab) setJobTab(jobTabTarget.dataset.jobTab);
          const settingsTabTarget = target instanceof Element ? target.closest('[data-settings-tab]') : null;
          if (settingsTabTarget?.dataset?.settingsTab) {
            setSettingsTab(settingsTabTarget.dataset.settingsTab);
            if (settingsTabTarget.dataset.settingsTab === 'keys') await loadProviderSettings();
            if (settingsTabTarget.dataset.settingsTab === 'users') await loadAdminUsers();
            if (settingsTabTarget.dataset.settingsTab === 'lists') await loadMarketLists();
            if (settingsTabTarget.dataset.settingsTab === 'sources') await Promise.all([loadNewsSourceSettings(), loadNewsSources()]);
          }
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
            try {
              await api('/admin/api/login', {
                method: 'POST',
                body: JSON.stringify({ loginId: $('loginId').value, password: $('password').value }),
              });
              $('loginMsg').textContent = '';
              await refreshSession();
            } catch (err) {
              const code = String(err?.message || '').trim();
              $('loginMsg').textContent = code === 'INVALID_LOGIN' ? textFor('loginInvalid') : textFor('loginFailed');
            }
          }
          if (target.id === 'logoutBtn') {
            await api('/admin/api/logout', { method: 'POST' });
            await refreshSession();
          }
          if (target.dataset.jobSave) {
            const key = target.dataset.jobSave;
            const scope = target.closest(`[data-job-edit-scope="${key}"]`) || document;
            await api(`/admin/api/jobs/${encodeURIComponent(key)}`, {
              method: 'PATCH',
              body: JSON.stringify({
                enabled: scope.querySelector(`[data-job-enabled="${key}"]`).checked,
                displayName: scope.querySelector(`[data-job-name="${key}"]`).value,
                description: scope.querySelector(`[data-job-desc="${key}"]`).value,
                intervalSeconds: Number(scope.querySelector(`[data-job-interval="${key}"]`).value),
              }),
            });
            await Promise.all([loadJobs(), loadDashboard()]);
          }
          if (target.dataset.jobRun) {
            await api(`/admin/api/jobs/${encodeURIComponent(target.dataset.jobRun)}/run`, { method: 'POST' });
            showToast(textFor('toastRunAcceptedTitle'), textFor('toastRunAcceptedBody'), { kind: 'success' });
            await new Promise((resolve) => setTimeout(resolve, 350));
            await Promise.all([loadJobs(), loadJobRuns(), loadDashboard(), loadMonitoring(), loadNews(), loadYoutube()]);
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
          if (target.dataset.providerEditOpen) {
            const provider = target.dataset.providerEditOpen;
            const hit = (state.providerSettings || []).find((p) => String(p.provider || '') === String(provider));
            if (!hit) return;
            state.providerEditDraft = {
              provider: hit.provider,
              enabled: hit.enabled !== false,
              hasApiKey: !!hit.hasApiKey,
              maskedApiKey: hit.maskedApiKey || '',
              defaultModel: hit.defaultModel || '',
            };
            // Render dialog fields
            if ($('providerEditDialog')) $('providerEditDialog').classList.remove('hidden');
            if ($('providerEditDialogMeta')) $('providerEditDialogMeta').textContent = String(hit.provider || '');
            if ($('providerEditEnabled')) $('providerEditEnabled').checked = hit.enabled !== false;
            if ($('providerEditDialogStatus')) $('providerEditDialogStatus').textContent = '';
            if ($('providerEditApiKey')) $('providerEditApiKey').value = '';
            if ($('providerEditApiKey')) $('providerEditApiKey').type = 'password';
            if ($('toggleProviderEditApiKey')) $('toggleProviderEditApiKey').textContent = textFor('btnShow');

            const isLlm = hit.provider === 'openai' || hit.provider === 'claude';
            if ($('providerEditModelRow')) $('providerEditModelRow').classList.toggle('hidden', !isLlm);
            if ($('providerEditDefaultModel')) {
              const models = isLlm
                ? modelPresetsForProviderView({ provider: hit.provider, defaultModel: hit.defaultModel, uiModelPresets: state.uiModelPresets })
                : [];
              const select = $('providerEditDefaultModel');
              select.innerHTML =
                `<option value="">${esc(textFor('providerSelectModel'))}</option>` +
                (models || []).map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
              select.value = String(hit.defaultModel || '');
            }
            if ($('deleteProviderEditApiKey')) $('deleteProviderEditApiKey').disabled = !hit.hasApiKey;
            return;
          }
          if (target.id === 'closeProviderEditDialog' || target.id === 'cancelProviderEditDialog') {
            state.providerEditDraft = null;
            $('providerEditDialog')?.classList.add('hidden');
            return;
          }
          if (target.id === 'toggleProviderEditApiKey') {
            const input = $('providerEditApiKey');
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
            target.textContent = input.type === 'password' ? textFor('btnShow') : textFor('btnHide');
            return;
          }
          if (target.id === 'providerEditDialog') {
            state.providerEditDraft = null;
            $('providerEditDialog')?.classList.add('hidden');
            return;
          }
          if (target.id === 'deleteProviderEditApiKey') {
            const draft = state.providerEditDraft;
            if (!draft?.provider) return;
            openConfirm({
              title: textFor('confirmProviderDeleteKeyTitle'),
              desc: textFor('confirmProviderDeleteKeyDesc'),
              body: textForVars('confirmProviderDeleteKeyBody', { provider: draft.provider }),
              okText: textFor('btnRemove'),
              danger: true,
              onConfirm: async () => {
                await api(`/admin/api/provider-settings/${draft.provider}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ clearApiKey: true }),
                });
                showToast(textFor('toastProviderKeyRemoved'), draft.provider, { kind: 'success' });
                $('providerEditDialog')?.classList.add('hidden');
                state.providerEditDraft = null;
                await loadProviderSettings();
              },
            });
            return;
          }
          if (target.id === 'saveProviderEditDialog') {
            const draft = state.providerEditDraft;
            if (!draft?.provider) return;
            const provider = draft.provider;
            const body = {
              enabled: !!$('providerEditEnabled')?.checked,
            };
            const isLlm = provider === 'openai' || provider === 'claude';
            if (isLlm && $('providerEditDefaultModel')) {
              body.defaultModel = $('providerEditDefaultModel').value.trim();
            }
            const apiKey = String($('providerEditApiKey')?.value || '').trim();
            if (apiKey) body.apiKey = apiKey;
            await api(`/admin/api/provider-settings/${provider}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            });
            showToast(textFor('toastSaved'), provider, { kind: 'success' });
            $('providerEditDialog')?.classList.add('hidden');
            state.providerEditDraft = null;
            await loadProviderSettings();
            return;
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
          if (target.id === 'saveAppSettingsBtn') {
            const raw = $('marketQuotesMaxAgeSecInput')?.value;
            const n = Math.floor(Number(raw));
            if (!Number.isFinite(n) || n < 0 || n > 300) {
              showToast(textFor('toastError'), textFor('appSettingsQuotesTitle'), { kind: 'danger' });
              return;
            }
            const result = await api('/admin/api/app-settings', {
              method: 'PATCH',
              body: JSON.stringify({ marketQuotesMaxAgeSec: n }),
            });
            state.appSettings = result.data || null;
            if ($('appSettingsStatus')) $('appSettingsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.appSettings?.updatedAt) });
            showToast(textFor('toastSaved'), textFor('appSettingsQuotesTitle'));
            if (state.view === 'settings-keys') {
              await loadProviderSettings();
            }
            return;
          }
          if (target.id === 'createAdminUserBtn') {
            const id = String($('adminUserNewId')?.value || '').trim();
            const password = String($('adminUserNewPassword')?.value || '');
            if (!id || !password) {
              showToast(textFor('toastErrorTitle'), textFor('adminUserMissingFields'), { kind: 'danger' });
              return;
            }
            await api('/admin/api/admin-users', {
              method: 'POST',
              body: JSON.stringify({ id, password, active: $('adminUserNewActive')?.checked !== false }),
            });
            showToast(textFor('toastSaved'), id, { kind: 'success' });
            await loadAdminUsers();
            return;
          }
          if (target.dataset.adminUserPasswordSave) {
            const id = target.dataset.adminUserPasswordSave;
            const input = document.querySelector(`[data-admin-user-password="${CSS.escape(id)}"]`);
            const password = String(input?.value || '');
            if (!password) {
              showToast(textFor('toastErrorTitle'), textFor('adminUserPasswordRequired'), { kind: 'danger' });
              return;
            }
            await api(`/admin/api/admin-users/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ password }),
            });
            showToast(textFor('toastSaved'), id, { kind: 'success' });
            await loadAdminUsers();
            return;
          }
          if (target.dataset.adminUserDelete) {
            const id = target.dataset.adminUserDelete;
            openConfirm({
              title: textFor('adminUserDeleteTitle'),
              desc: textFor('adminUserDeleteDesc'),
              body: textForVars('adminUserDeleteBody', { id }),
              okText: textFor('btnRemove'),
              danger: true,
              onConfirm: async () => {
                await api(`/admin/api/admin-users/${encodeURIComponent(id)}`, { method: 'DELETE' });
                showToast(textFor('toastDataResetDone'), id, { kind: 'success' });
                await loadAdminUsers();
              },
            });
            return;
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
          if (target?.closest?.('#saveNewsEditDialog')) {
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
          {
            const tagBtn = target instanceof Element ? target.closest('button') : null;
            if (tagBtn?.id === 'newsEditSaveHashtagsBtn') {
              const id = state.newsEditItemId;
              if (!id) return;
              const loc = $('newsLocale').value || 'ko';
              const raw = $('newsEditHashtagsInput')?.value ?? '';
              const lines = raw
                .split(/[\n,]+/)
                .map((s) => String(s).trim().replace(/^#+/u, ''))
                .filter(Boolean);
              await api(
                `/admin/api/news/${encodeURIComponent(id)}/hashtags?locale=${encodeURIComponent(loc)}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify({ hashtags: lines }),
                },
              );
              showToast(textFor('toastSaved'), textFor('newsHashtagsSaved'), { kind: 'success' });
              await loadNews();
              renderNewsEditDialog();
              return;
            }
            if (tagBtn?.id === 'newsEditHashtagResetAutoBtn') {
              const id = state.newsEditItemId;
              if (!id) return;
              const loc = $('newsLocale').value || 'ko';
              await api(
                `/admin/api/news/${encodeURIComponent(id)}/hashtags?locale=${encodeURIComponent(loc)}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify({ hashtagSource: 'auto' }),
                },
              );
              showToast(textFor('toastSaved'), textFor('newsHashtagResetSaved'), { kind: 'success' });
              await loadNews();
              renderNewsEditDialog();
              return;
            }
          }
          if (target.id === 'loadNewsBtn') {
            state.newsPage = 1;
            await loadNews();
          }
          if (target.id === 'resetNewsBtn') {
            if ($('newsRange')) $('newsRange').value = '7d';
            if ($('newsFrom')) $('newsFrom').value = '';
            if ($('newsTo')) $('newsTo').value = '';
            if ($('newsCategory')) $('newsCategory').value = '';
            if ($('newsTranslationStatus')) $('newsTranslationStatus').value = '';
            if ($('newsQuery')) $('newsQuery').value = '';
            if ($('newsPageSize')) $('newsPageSize').value = '30';
            setDatePreset();
            state.newsPage = 1;
            await loadNews();
          }
          if (target.id === 'loadJobRunsBtn') {
            state.jobRunsPage = 1;
            await loadJobRuns();
          }
          if (target.id === 'resetJobRunsBtn') {
            if ($('jobRunRange')) $('jobRunRange').value = 'today';
            if ($('jobRunFrom')) $('jobRunFrom').value = '';
            if ($('jobRunTo')) $('jobRunTo').value = '';
            if ($('jobRunStatus')) $('jobRunStatus').value = '';
            if ($('jobRunType')) $('jobRunType').value = '';
            if ($('jobRunJob')) $('jobRunJob').value = '';
            if ($('jobRunTrigger')) $('jobRunTrigger').value = '';
            if ($('jobRunQuery')) $('jobRunQuery').value = '';
            if ($('jobRunPageSize')) $('jobRunPageSize').value = '30';
            setJobRunDatePreset();
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
          if (target.id === 'loadInsightsBtn') {
            syncInsightFiltersFromDom();
            state.insightsPage = 1;
            await loadInsights();
          }
          if (target.id === 'resetInsightsBtn') {
            state.insightFilters = {
              range: '7d',
              from: '',
              to: '',
              kind: '',
              level: '',
              push: '',
              q: '',
              pageSize: '30',
            };
            state.insightsPage = 1;
            await loadInsights();
          }
          if (target.dataset.insightsPage === 'prev' && state.insightsPage > 1) {
            syncInsightFiltersFromDom();
            state.insightsPage -= 1;
            await loadInsights();
          }
          if (target.dataset.insightsPage === 'next' && state.insightsPage < state.insightsTotalPages) {
            syncInsightFiltersFromDom();
            state.insightsPage += 1;
            await loadInsights();
          }
          if (target.id === 'loadYoutubeBtn') {
            state.youtubePage = 1;
            await loadYoutube();
          }
          if (target.id === 'loadCalendarBtn') {
            state.calendarSelectedYmd = '';
            await loadCalendar();
          }
          if (target.id === 'resetCalendarBtn') {
            if ($('calendarRange')) $('calendarRange').value = 'today';
            setCalendarDatePreset();
            if ($('calendarType')) $('calendarType').value = '';
            if ($('calendarSymbol')) $('calendarSymbol').value = '';
            if ($('calendarQuery')) $('calendarQuery').value = '';
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
          if (target.dataset.calendarRangePrev) {
            const rows = [...(state.calendarMonthRows || [])];
            const dates = [...new Set(rows.map((r) => String(r.date || '').slice(0, 10)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
            const cur = state.calendarRangeFocusYmd || dates[0] || '__all__';
            const idx = dates.indexOf(cur);
            if (idx > 0) state.calendarRangeFocusYmd = dates[idx - 1];
            renderCalendarDayTable();
            return;
          }
          if (target.dataset.calendarRangeNext) {
            const rows = [...(state.calendarMonthRows || [])];
            const dates = [...new Set(rows.map((r) => String(r.date || '').slice(0, 10)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
            const cur = state.calendarRangeFocusYmd || dates[0] || '__all__';
            const idx = dates.indexOf(cur);
            if (idx >= 0 && idx < dates.length - 1) state.calendarRangeFocusYmd = dates[idx + 1];
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
          setUrlParam('lang', event.target.value);
          applyAdminLanguage();
          const adminOpen = $('adminPanel') && !$('adminPanel').classList.contains('hidden');
          if (adminOpen) {
            await reloadAllAdminData();
            await switchView(state.view || 'dashboard');
          }
        }
        if (event.target.id === 'adminTimeBasis') {
          localStorage.setItem('signalAdminTimeBasis', event.target.value);
          setDatePreset();
          setJobRunDatePreset();
          setCalendarDatePreset();
          await Promise.all([loadDashboard(), loadJobs(), loadJobRuns(), loadInsights(), loadNews(), loadYoutube()]);
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
        if (event.target.id === 'calendarRange') {
          setCalendarDatePreset();
          state.calendarSelectedYmd = '';
          await loadCalendar();
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
        if (event.target.dataset.adminUserActive) {
          const id = event.target.dataset.adminUserActive;
          try {
            await api(`/admin/api/admin-users/${encodeURIComponent(id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ active: !!event.target.checked }),
            });
            showToast(textFor('toastSaved'), id, { kind: 'success' });
            await loadAdminUsers();
          } catch (error) {
            event.target.checked = !event.target.checked;
            showToast(textFor('toastErrorTitle'), error?.message || textFor('loginFailed'), { kind: 'danger' });
          }
        }
        if (event.target.id === 'jobRunRange') {
          setJobRunDatePreset();
          state.jobRunsPage = 1;
          await loadJobRuns();
        }
        if (event.target.id === 'insightRange') {
          state.insightFilters = { ...(state.insightFilters || {}), range: event.target.value || '7d' };
          applyInsightDatePresetToState();
          state.insightsPage = 1;
          await loadInsights();
        }
        if (event.target.id === 'jobRunJob') {
          state.jobRunsPage = 1;
          await loadJobRuns();
        }
        if (event.target.id === 'calendarFrom' || event.target.id === 'calendarTo') {
          state.calendarSelectedYmd = '';
          await loadCalendar();
        }
        if (event.target.dataset && event.target.dataset.calendarRangeDay === 'pick') {
          state.calendarSelectedYmd = '';
          state.calendarRangeFocusYmd = event.target.value;
          renderCalendarDayTable();
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
        if (
          event.key === 'Enter' &&
          (event.target.id === 'jobRunQuery' || event.target.id === 'jobRunFrom' || event.target.id === 'jobRunTo')
        ) {
          event.preventDefault();
          document.getElementById('loadJobRunsBtn')?.click();
        }
        if (
          event.key === 'Enter' &&
          (event.target.id === 'insightQuery' || event.target.id === 'insightFrom' || event.target.id === 'insightTo')
        ) {
          event.preventDefault();
          document.getElementById('loadInsightsBtn')?.click();
        }
      });

      applyTheme(localStorage.getItem('signalAdminAccent') || 'green');
      state.dashboardLimit = Number(localStorage.getItem('signalAdminDashboardLimit') || '5') || 5;
      const urlLang = normalizeAdminLang(getUrlParam('lang'));
      if (urlLang) localStorage.setItem('signalAdminLanguage', urlLang);
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
      // Ensure date preset defaults hydrate from/to inputs.
      setDatePreset();
      setJobRunDatePreset();
      setCalendarDatePreset();
      refreshSession().catch((error) => { $('session').textContent = error.message; });
      updateResetUi();
      // Keep settings tab stable across refreshes
      if ($('settingsTab-users')) setSettingsTab(state.settingsTab || 'users');
      initAdminHeaderHeightSync();
      initScrollTopButton();
      enhanceMobileAdminSurfaces();
