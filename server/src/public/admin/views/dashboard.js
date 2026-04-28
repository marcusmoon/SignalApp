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

