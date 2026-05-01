export async function loadDashboardView(ctx) {
  const {
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
  } = ctx;

  const summary = (await api('/admin/api/summary')).data;
  const allRuns = Array.isArray(summary.recentRuns) ? summary.recentRuns : [];
  const dataAreas = Array.isArray(summary.dataAreas) ? summary.dataAreas : [];
  const latestNews = Array.isArray(summary.latestNews) ? summary.latestNews : [];
  const latestYoutube = Array.isArray(summary.latestYoutube) ? summary.latestYoutube : [];
  const limit = Math.max(3, Math.min(10, Number(state.dashboardLimit) || 5));
  const op = state.dashboardOperationFilter === 'reconcile' ? 'reconcile' : 'latest';
  const opFiltered = allRuns.filter((r) => (r.operation || 'latest') === op);
  const sorted = [...opFiltered]
    .sort(
      (a, b) =>
        new Date(b.finishedAt || b.startedAt || 0).getTime() - new Date(a.finishedAt || a.startedAt || 0).getTime(),
    )
    .slice(0, limit);
  const staleCount = allRuns.filter((r) => r.stale).length;
  const failedCount = allRuns.filter((r) => String(r.status) === 'failed').length;
  const newsRows = latestNews.slice(0, limit);
  const youtubeRows = latestYoutube.slice(0, limit);

  function areaMeta(id) {
    const map = {
      news: { label: textFor('statNews'), icon: 'N', runType: 'news' },
      calendar: { label: textFor('statCalendar'), icon: 'C', runType: 'calendar' },
      concalls: { label: textFor('statConcalls'), icon: 'T', runType: 'concalls' },
      youtube: { label: textFor('statYoutube'), icon: 'Y', runType: 'youtube' },
      marketQuotes: { label: textFor('statQuotes'), icon: 'Q', runType: 'market_quotes' },
      coinMarkets: { label: textFor('statCoins'), icon: 'B', runType: 'coin_markets' },
    };
    return map[id] || { label: id, icon: '?', runType: id };
  }

  function areaStatus(area) {
    if (area.runningRun) return { key: 'statusRunning', className: 'pillStatus--run' };
    if (area.latestRun?.status === 'failed') return { key: 'statusFailed', className: 'pillStatus--fail' };
    if (Number(area.staleJobs || 0) > 0) return { key: 'runStale', className: 'pillStatus--warn' };
    if (Number(area.count || 0) === 0 && area.latestRun) return { key: 'dashboardStatusEmpty', className: 'pillStatus--warn' };
    if (area.latestSuccess) return { key: 'statusCompleted', className: 'pillStatus--ok' };
    if (Number(area.count || 0) > 0) return { key: 'dashboardStatusStored', className: 'pillStatus--ok' };
    return { key: 'statusNotRun', className: 'pillStatus--muted' };
  }

  function areaQuality(area) {
    const q = area.quality || {};
    if (area.id === 'news') return textForVars('dashboardQualityNews', { translations: q.translations || 0, sources: q.sources || 0 });
    if (area.id === 'calendar') return textForVars('dashboardQualityCalendar', { future: q.futureEvents || 0 });
    if (area.id === 'concalls')
      return textForVars('dashboardQualityConcalls', {
        transcripts: q.withTranscript || 0,
        summarized: q.summarized || 0,
        symbols: q.symbols || 0,
      });
    if (area.id === 'youtube') return textForVars('dashboardQualityYoutube', { channels: q.channels || 0 });
    if (area.id === 'marketQuotes') return textForVars('dashboardQualityQuotes', { symbols: q.symbols || 0, segments: q.segments || 0 });
    if (area.id === 'coinMarkets') return textForVars('dashboardQualityCoins', { symbols: q.symbols || 0 });
    return '';
  }

  function areaCard(area) {
    const meta = areaMeta(area.id);
    const status = areaStatus(area);
    const latestRunAt = area.latestRun?.finishedAt || area.latestRun?.startedAt || null;
    return `
      <article class="dashboardDataCard dashboardDataCard--${esc(status.className.replace('pillStatus--', ''))}">
        <div class="dashboardDataHead">
          <div class="dashboardDataTitle"><span class="statIcon">${esc(meta.icon)}</span>${esc(meta.label)}</div>
          <div class="dashboardDataActions">
            <span class="pill pillStatus ${esc(status.className)}">${esc(textFor(status.key))}</span>
            <button class="pill dashboardLogPill" data-dashboard-run-type="${esc(meta.runType)}">${esc(textFor('btnLog'))}</button>
          </div>
        </div>
        <div class="dashboardDataLine">
          <strong>${esc(textForVars('dashboardStoredCount', { count: Number(area.count || 0).toLocaleString() }))}</strong>
          <span>${esc(textForVars('dashboardLastResultShort', { count: String(area.latestRun?.itemCount ?? '-') }))}</span>
        </div>
        <div class="dashboardDataMetaLine">
          <span>${esc(textForVars('dashboardLatestRunShort', { time: formatDateTime(latestRunAt) }))}</span>
          <span>${esc(areaQuality(area))}</span>
        </div>
      </article>
    `;
  }

  $('dashboard').innerHTML = `
    <section class="card card--elevated dashboardPanel dashboardHealthPanel">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('dashboardHealthTitle'))}</div>
          <div class="cardHint">${esc(textFor('dashboardHealthHint'))}</div>
        </div>
      </div>
      <div class="dashboardDataGrid">
        ${dataAreas.map((area) => areaCard(area)).join('') || `<p class="muted">${esc(textFor('dashboardEmpty'))}</p>`}
      </div>
    </section>
    <section class="card card--elevated dashboardPanel dashboardContentPanel">
      <div class="dashboardToolbar">
        <div>
          <div class="cardKicker">${esc(textFor('dashboardOverviewTitle'))}</div>
          <div class="cardHint">${esc(textForVars('dashboardOverviewHint', { count: String(limit) }))}</div>
        </div>
        <label class="fieldLabel dashboardLimit dashboardLimit--compact">
          <span class="srOnly">${esc(textFor('dashboardLimitLabel'))}</span>
          <select id="dashboardLimit">
            ${[3, 5, 10].map((n) => `<option value="${n}" ${limit === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="dashboardGrid">
        <section class="dashboardPanel dashboardSubPanel">
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
        <section class="dashboardPanel dashboardSubPanel">
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
    </section>
    <div class="card card--elevated dashboardPanel dashboardJobsPanel">
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
            <tr class="${String(run.status) === 'failed' ? 'failedRow' : run.stale ? 'staleRow' : ''}">
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
