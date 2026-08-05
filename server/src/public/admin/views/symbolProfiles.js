export async function loadSymbolProfilesView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  const q = String(state.symbolProfilesQ || '').trim();
  const market = String(state.symbolProfilesMarket || '').trim();
  const page = Math.max(Number(state.symbolProfilesPage) || 1, 1);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (market) params.set('market', market);
  params.set('page', String(page));
  params.set('pageSize', '50');
  const body = await api(`/admin/api/symbol-profiles?${params.toString()}`);
  const data = body.data || {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  state.symbolProfiles = rows;
  state.symbolProfilesTotal = Number(data.total) || 0;
  const totalPages = Math.max(1, Math.ceil((Number(data.total) || 0) / (Number(data.limit) || 50)));
  state.symbolProfilesTotalPages = totalPages;
  if (page > totalPages) state.symbolProfilesPage = totalPages;

  const host = $('symbolProfiles');
  if (!host) return;

  host.innerHTML = `
    <div class="card settingsControlCard">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('symbolProfilesCardTitle'))}</div>
          <div class="cardHint">${esc(textFor('symbolProfilesCardHint'))}</div>
        </div>
        <div class="cardHeadActions">
          <button type="button" class="success" id="symbolProfileCreateBtn">${esc(textFor('symbolProfileCreate'))}</button>
        </div>
      </div>
      <div class="settingsSectionBody">
        <div class="filterBar">
          <label class="fieldLabel">
            <span>${esc(textFor('symbolProfileFilterQ'))}</span>
            <input id="symbolProfilesQ" value="${esc(q)}" placeholder="${esc(textFor('symbolProfileFilterQPh'))}" />
          </label>
          <label class="fieldLabel">
            <span>${esc(textFor('symbolProfileFilterMarket'))}</span>
            <select id="symbolProfilesMarket">
              <option value="" ${!market ? 'selected' : ''}>${esc(textFor('symbolProfileMarketAll'))}</option>
              <option value="kr" ${market === 'kr' ? 'selected' : ''}>kr</option>
              <option value="global" ${market === 'global' ? 'selected' : ''}>global</option>
            </select>
          </label>
          <button type="button" class="secondary" id="symbolProfilesSearchBtn">${esc(textFor('btnSearch'))}</button>
        </div>
        <div class="muted" style="margin:8px 0 12px">
          ${esc(textForVars('symbolProfilesCount', { n: state.symbolProfilesTotal, page: state.symbolProfilesPage, pages: state.symbolProfilesTotalPages }))}
        </div>
        ${
          rows.length === 0
            ? `<p class="muted">${esc(textFor('symbolProfilesEmpty'))}</p>`
            : `
          <div class="tableWrap">
            <table class="dataTable">
              <thead>
                <tr>
                  <th>${esc(textFor('symbolProfileColLogo'))}</th>
                  <th>${esc(textFor('symbolProfileColMarket'))}</th>
                  <th>${esc(textFor('symbolProfileColSymbol'))}</th>
                  <th>${esc(textFor('symbolProfileColName'))}</th>
                  <th>${esc(textFor('symbolProfileColLogoUrl'))}</th>
                  <th>${esc(textFor('symbolProfileColUpdated'))}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const logo = row.logoUrl
                      ? `<img src="${esc(row.logoUrl)}" alt="" width="24" height="24" style="border-radius:6px;object-fit:cover;background:var(--bgElevated)" />`
                      : `<span class="muted">—</span>`;
                    return `
                  <tr>
                    <td>${logo}</td>
                    <td><span class="pill pill--subtle">${esc(row.market)}</span></td>
                    <td><strong>${esc(row.displaySymbol || row.symbol)}</strong><div class="muted">${esc(row.symbolKey)}</div></td>
                    <td>${esc(row.name || '—')}</td>
                    <td class="muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(row.logoUrl || '—')}</td>
                    <td class="muted">${esc(formatDateTime(row.updatedAt))}</td>
                    <td class="row">
                      <button type="button" class="secondary" data-symbol-profile-edit="${esc(row.symbolKey)}">${esc(textFor('btnEdit'))}</button>
                      <button type="button" class="danger" data-symbol-profile-delete="${esc(row.symbolKey)}">${esc(textFor('btnDeleteRow'))}</button>
                    </td>
                  </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
          <div class="row" style="margin-top:12px;gap:8px">
            <button type="button" class="secondary" id="symbolProfilesPrevBtn" ${state.symbolProfilesPage <= 1 ? 'disabled' : ''}>${esc(textFor('btnPrevious'))}</button>
            <button type="button" class="secondary" id="symbolProfilesNextBtn" ${state.symbolProfilesPage >= state.symbolProfilesTotalPages ? 'disabled' : ''}>${esc(textFor('btnNext'))}</button>
          </div>
        `
        }
      </div>
    </div>
  `;
}

export function openSymbolProfileDialogView(ctx) {
  const { mode, row, $, state, textFor } = ctx;
  state.symbolProfileDraft = {
    mode: mode === 'edit' ? 'edit' : 'create',
    symbolKey: row?.symbolKey || '',
    market: row?.market || 'global',
    symbol: row?.symbol || row?.displaySymbol || '',
    name: row?.name || '',
    exchange: row?.exchange || '',
    logoUrl: row?.logoUrl || '',
  };
  renderSymbolProfileDialogView({ $, state, textFor });
}

export function closeSymbolProfileDialogView(ctx) {
  const { $, state, textFor } = ctx;
  state.symbolProfileDraft = null;
  renderSymbolProfileDialogView({ $, state, textFor });
}

export function renderSymbolProfileDialogView(ctx) {
  const { $, state, textFor } = ctx;
  const dialog = $('symbolProfileDialog');
  if (!dialog) return;
  const draft = state.symbolProfileDraft;
  if (!draft) {
    dialog.classList.add('hidden');
    return;
  }
  dialog.classList.remove('hidden');
  const title = $('symbolProfileDialogTitle');
  if (title) {
    title.textContent =
      draft.mode === 'edit' ? textFor('symbolProfileEditTitle') : textFor('symbolProfileCreateTitle');
  }
  const meta = $('symbolProfileDialogMeta');
  if (meta) meta.textContent = draft.symbolKey || '';
  const market = $('symbolProfileDialogMarket');
  const symbol = $('symbolProfileDialogSymbol');
  const name = $('symbolProfileDialogName');
  const exchange = $('symbolProfileDialogExchange');
  const logoUrl = $('symbolProfileDialogLogoUrl');
  if (market) {
    market.value = draft.market === 'kr' ? 'kr' : 'global';
    market.disabled = draft.mode === 'edit';
  }
  if (symbol) {
    symbol.value = draft.symbol || '';
    symbol.disabled = draft.mode === 'edit';
  }
  if (name) name.value = draft.name || '';
  if (exchange) exchange.value = draft.exchange || '';
  if (logoUrl) logoUrl.value = draft.logoUrl || '';
}

export function readSymbolProfileDialogDraft(ctx) {
  const { $ } = ctx;
  return {
    market: $('symbolProfileDialogMarket')?.value || 'global',
    symbol: $('symbolProfileDialogSymbol')?.value || '',
    name: $('symbolProfileDialogName')?.value || '',
    exchange: $('symbolProfileDialogExchange')?.value || '',
    logoUrl: $('symbolProfileDialogLogoUrl')?.value || '',
  };
}
