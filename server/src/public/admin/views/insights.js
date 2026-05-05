import { timeBasis } from '../format.js';
import { renderIngestWorkflowNav } from './ingestNav.js';

function insightQueryParams({ state, $ }) {
  const filters = state.insightFilters || {};
  const params = new URLSearchParams({
    page: String(state.insightsPage || 1),
    pageSize: filters.pageSize || $('insightPageSize')?.value || '30',
  });
  for (const [key, id] of [
    ['q', 'insightQuery'],
    ['from', 'insightFrom'],
    ['to', 'insightTo'],
    ['kind', 'insightKind'],
    ['level', 'insightLevel'],
    ['pushCandidate', 'insightPush'],
  ]) {
    const filterKey = key === 'pushCandidate' ? 'push' : key;
    const value = String(filters[filterKey] ?? $(''+id)?.value ?? '').trim();
    if (value) params.set(key, value);
  }
  if (params.has('from') || params.has('to')) params.set('timeZone', timeBasis().timeZone);
  return params.toString();
}

function sourceRefs(item) {
  const refs = Array.isArray(item.sourceRefs) ? item.sourceRefs : [];
  if (!refs.length) return '-';
  return refs.slice(0, 3);
}

function sourceText(item, esc) {
  const refs = sourceRefs(item);
  if (refs === '-') return '-';
  return refs
    .map((ref) => ref.sourceName || ref.title || ref.type || '-')
    .map(esc)
    .join(' · ');
}

function sourceLinks(item, esc) {
  const refs = sourceRefs(item);
  if (refs === '-') return '-';
  return refs
    .map((ref) => {
      const label = ref.sourceName || ref.title || ref.type || '-';
      if (!ref.url) return `<span>${esc(label)}</span>`;
      return `<a class="inlineSourceLink" href="${esc(ref.url)}" target="_blank" rel="noreferrer">${esc(label)} ↗</a>`;
    })
    .join(' · ');
}

function llmText(item, textFor) {
  const llm = item.llm || {};
  if (llm.status === 'ready') return `${llm.provider || '-'}${llm.model ? ` · ${llm.model}` : ''}`;
  return textFor('insightLlmNotConfigured');
}

function renderPager({ targetId, state, $, esc, textForVars, textFor }) {
  $(targetId).innerHTML = `
    <div class="muted">${esc(textForVars('pagerSummary', { total: state.insightsTotal, page: state.insightsPage, pages: state.insightsTotalPages }))}</div>
    <div class="row">
      <button class="secondary" data-insights-page="prev">${esc(textFor('btnPrevious'))}</button>
      <button class="secondary" data-insights-page="next">${esc(textFor('btnNext'))}</button>
    </div>
  `;
}

export async function loadInsightsView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  const filters = state.insightFilters || {};
  const body = await api(`/admin/api/insights?${insightQueryParams({ state, $ })}`);
  const rows = Array.isArray(body.data) ? body.data : [];
  state.insightRows = rows;
  state.insightsPage = body.page || 1;
  state.insightsTotalPages = body.totalPages || 1;
  state.insightsTotal = body.total || rows.length;

  $('insights').innerHTML = `
    ${renderIngestWorkflowNav({ activeView: 'insights', esc, textFor })}
    <div class="card insightAdminSummary">
      <div>
        <div class="cardKicker">${esc(textFor('insightAdminSummaryTitle'))}</div>
        <p class="summary">${esc(textFor('insightAdminSummaryDesc'))}</p>
      </div>
      <span class="pill pillStatus--ok">${esc(textForVars('insightAdminTotal', { count: state.insightsTotal }))}</span>
    </div>
    <div class="filterBar filterBox">
      <div class="filterBarTitle filterBoxTitle">${esc(textFor('filterSearchConditions'))}</div>
      <div class="filterBarControls toolbar jobsFilterGroups">
        <div class="filterGroup filterGroup--date">
          <span class="filterGroupTitle">${esc(textFor('filterGroupDate'))}</span>
          <select id="insightRange">
            <option value="today" ${filters.range === 'today' ? 'selected' : ''}>${esc(textFor('datePresetToday'))}</option>
            <option value="7d" ${!filters.range || filters.range === '7d' ? 'selected' : ''}>${esc(textFor('datePreset7d'))}</option>
            <option value="30d" ${filters.range === '30d' ? 'selected' : ''}>${esc(textFor('datePreset30d'))}</option>
            <option value="all" ${filters.range === 'all' ? 'selected' : ''}>${esc(textFor('datePresetAll'))}</option>
            <option value="custom" ${filters.range === 'custom' ? 'selected' : ''}>${esc(textFor('datePresetCustom'))}</option>
          </select>
          <input id="insightFrom" type="date" value="${esc(filters.from || '')}" />
          <span class="dateRangeSep" aria-hidden="true">~</span>
          <input id="insightTo" type="date" value="${esc(filters.to || '')}" />
        </div>
        <div class="filterGroup filterGroup--facets">
          <span class="filterGroupTitle">${esc(textFor('filterGroupFilters'))}</span>
          <select id="insightKind">
            <option value="">${esc(textFor('insightKindAll'))}</option>
            <option value="market_brief" ${filters.kind === 'market_brief' ? 'selected' : ''}>market_brief</option>
            <option value="asset_signal" ${filters.kind === 'asset_signal' ? 'selected' : ''}>asset_signal</option>
          </select>
          <select id="insightLevel">
            <option value="">${esc(textFor('insightLevelAll'))}</option>
            <option value="brief" ${filters.level === 'brief' ? 'selected' : ''}>brief</option>
            <option value="watch" ${filters.level === 'watch' ? 'selected' : ''}>watch</option>
            <option value="alert" ${filters.level === 'alert' ? 'selected' : ''}>alert</option>
          </select>
          <select id="insightPush">
            <option value="">${esc(textFor('insightPushAll'))}</option>
            <option value="true" ${filters.push === 'true' ? 'selected' : ''}>${esc(textFor('insightPushYes'))}</option>
            <option value="false" ${filters.push === 'false' ? 'selected' : ''}>${esc(textFor('insightPushNo'))}</option>
          </select>
          <select id="insightPageSize">
            <option value="20" ${filters.pageSize === '20' ? 'selected' : ''}>${esc(textFor('pageSize20'))}</option>
            <option value="30" ${!filters.pageSize || filters.pageSize === '30' ? 'selected' : ''}>${esc(textFor('pageSize30'))}</option>
            <option value="50" ${filters.pageSize === '50' ? 'selected' : ''}>${esc(textFor('pageSize50'))}</option>
            <option value="100" ${filters.pageSize === '100' ? 'selected' : ''}>${esc(textFor('pageSize100'))}</option>
          </select>
        </div>
        <div class="filterGroup filterGroup--search">
          <span class="filterGroupTitle">${esc(textFor('filterGroupSearch'))}</span>
          <input id="insightQuery" class="wide" placeholder="${esc(textFor('insightQueryPlaceholder'))}" value="${esc(filters.q || '')}" />
          <button id="loadInsightsBtn" class="secondary">${esc(textFor('btnSearch'))}</button>
          <button id="resetInsightsBtn" class="secondary">${esc(textFor('btnResetQuery'))}</button>
        </div>
      </div>
    </div>
    <div id="insightsPagerTop" class="pager"></div>
    <div class="card insightDesktopTableCard">
      <table class="settingsTable">
        <thead>
          <tr>
            <th>${esc(textFor('colTitle'))}</th>
            <th>${esc(textFor('colType'))}</th>
            <th class="right">${esc(textFor('colScore'))}</th>
            <th>${esc(textFor('insightGeneratedAt'))}</th>
            <th>${esc(textFor('insightSources'))}</th>
            <th>${esc(textFor('insightLlm'))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((item) => `
            <tr>
              <td>
                <strong>${esc(item.title || '-')}</strong>
                <div class="muted insightSummaryCell">${esc(item.summary || '')}</div>
                <div class="insightSymbolRow">${(item.symbols || []).slice(0, 5).map((symbol) => `<span class="pill">${esc(symbol)}</span>`).join('')}</div>
              </td>
              <td><span class="pill">${esc(item.kind || '-')}</span><br/><span class="pill pillStatus ${item.pushCandidate ? 'pillStatus--warn' : 'pillStatus--muted'}">${esc(item.level || '-')}</span></td>
              <td class="right"><strong>${Number(item.score || 0)}</strong></td>
              <td class="muted">${esc(formatDateTime(item.generatedAt))}</td>
              <td class="muted">${sourceLinks(item, esc)}</td>
              <td class="muted">${esc(llmText(item, textFor))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${rows.length === 0 ? `<p class="muted">${esc(textFor('insightsEmpty'))}</p>` : ''}
    </div>
    <div class="mobileInsightList">
      ${rows.map((item) => `
        <article class="mobileInsightCard">
          <div class="mobileRunCardHead">
            <div class="mobileJobTitle">
              <strong>${esc(item.title || '-')}</strong>
              <span class="muted">${esc(formatDateTime(item.generatedAt))}</span>
            </div>
            <span class="pill pillStatus ${item.pushCandidate ? 'pillStatus--warn' : 'pillStatus--muted'}">${esc(item.level || '-')} · ${Number(item.score || 0)}</span>
          </div>
          <p class="summary">${esc(item.summary || '')}</p>
          <div class="mobileJobMeta">
            <span class="pill">${esc(item.kind || '-')}</span>
            ${(item.symbols || []).slice(0, 4).map((symbol) => `<span class="pill">${esc(symbol)}</span>`).join('')}
          </div>
          <div class="mobileRunStats">
            <span>${esc(textFor('insightSources'))} <strong>${sourceLinks(item, esc)}</strong></span>
            <span>${esc(textFor('insightLlm'))} <strong>${esc(llmText(item, textFor))}</strong></span>
          </div>
        </article>
      `).join('') || `<p class="muted">${esc(textFor('insightsEmpty'))}</p>`}
    </div>
    <div id="insightsPagerBottom" class="pager"></div>
  `;
  renderPager({ targetId: 'insightsPagerTop', state, $, esc, textForVars, textFor });
  renderPager({ targetId: 'insightsPagerBottom', state, $, esc, textForVars, textFor });
}
