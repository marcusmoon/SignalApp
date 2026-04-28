export function renderNewsSourcesView(ctx) {
  const { $, state, esc, textFor, textForVars } = ctx;
  const host = $('newsSources');
  if (!host) return;
  const cat = state.newsSourcesCategory || 'global';
  const rows = [...(state.newsSources || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)),
  );
  const policy = state.newsSourceSettings?.autoEnableNewSources || { global: true, crypto: true };
  const aliasesByCat = state.newsSourceSettings?.aliases || { global: {}, crypto: {} };
  const aliasTable = aliasesByCat[cat] || {};
  const aliasCountFor = (name) =>
    Object.entries(aliasTable).filter(([, v]) => String(v || '') === String(name || '')).length;
  const draftRows =
    Array.isArray(state.newsSourceDraftRows) && state.newsSourceDraftRows.length ? state.newsSourceDraftRows : [''];
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
                ${rows
                  .map(
                    (s, idx) => `
                  <tr class="${s.hidden ? 'mutedRow' : ''}">
                    <td class="muted">${idx + 1}</td>
                    <td><strong>${esc(s.name)}</strong>${s.hidden ? ` <span class="pill">${esc(textFor('newsSourcesHide'))}</span>` : ''}</td>
                    <td><input type="checkbox" data-news-source-enabled="${esc(s.id)}" ${s.enabled ? 'checked' : ''} ${s.hidden ? 'disabled' : ''}/></td>
                    <td class="muted">${Number(s.order) || idx + 1}</td>
                    <td class="tableActions">
                      <button class="iconBtn" title="Move up" data-news-source-move="up" data-news-source-id="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>↑</button>
                      <button class="iconBtn" title="Move down" data-news-source-move="down" data-news-source-id="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>↓</button>
                      <button class="secondary compactBtn" data-news-source-alias-open="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>${esc(
                        aliasCountFor(s.name)
                          ? textForVars('newsSourceAliasButton', { count: `(${aliasCountFor(s.name)})` })
                          : textFor('newsSourcesAliasTitle'),
                      )}</button>
                      <button class="secondary compactBtn" data-news-source-toggle-hidden="${esc(s.id)}">${esc(
                        s.hidden ? textFor('newsSourcesUnhide') : textFor('newsSourcesHide'),
                      )}</button>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
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
                ${draftRows
                  .map(
                    (value, idx) => `
                  <div class="sourceDraftRow">
                    <span class="muted">${idx + 1}</span>
                    <input class="newsSourcesAddInput" data-news-source-draft-index="${idx}" placeholder="${esc(textFor('newsSourceAddPh'))}" value="${esc(value || '')}" />
                    <button class="danger compactBtn" data-news-source-draft-remove="${idx}" ${draftRows.length <= 1 ? 'disabled' : ''}>${esc(textFor('btnRemove'))}</button>
                  </div>
                `,
                  )
                  .join('')}
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

export async function loadNewsSourcesView(ctx) {
  const { api, state } = ctx;
  const cat = state.newsSourcesCategory || 'global';
  const includeHidden = state.newsSourcesShowHidden ? '&includeHidden=1' : '';
  const body = await api(`/admin/api/news-sources?category=${encodeURIComponent(cat)}${includeHidden}`);
  state.newsSources = Array.isArray(body.data) ? body.data : [];
  renderNewsSourcesView(ctx);
}

export async function loadNewsSourceSettingsView(ctx) {
  const { api, state } = ctx;
  const body = await api('/admin/api/news-source-settings');
  state.newsSourceSettings = body.data || state.newsSourceSettings;
  renderNewsSourcesView(ctx);
}

export async function saveNewsSourceSettingsView(ctx) {
  const { api, state, $, textFor, showToast } = ctx;
  const patch = {
    autoEnableNewSources: {
      global: !!$('newsSourcesAutoEnableGlobal')?.checked,
      crypto: !!$('newsSourcesAutoEnableCrypto')?.checked,
    },
  };
  const body = await api('/admin/api/news-source-settings', { method: 'PATCH', body: JSON.stringify(patch) });
  state.newsSourceSettings = body.data || state.newsSourceSettings;
  showToast(textFor('toastSaved') || 'Saved', textFor('newsSourcePolicyTitle'), { kind: 'success' });
  await loadNewsSourcesView(ctx);
}

export function closeNewsSourceAliasDialogView({ state, $ }) {
  state.newsSourceAliasDraft = null;
  if ($('newsSourceAliasDialog')) $('newsSourceAliasDialog').classList.add('hidden');
}

export function renderNewsSourceAliasDialogView({ state, $, esc, textFor, textForVars }) {
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
    ${draft.aliases
      .map(
        (a, idx) => `
      <div class="symbolRow">
        <div class="muted">${idx + 1}</div>
        <input class="readonlyInput" value="${esc(a)}" disabled />
        <button class="danger" data-news-source-alias-remove="${idx}">${esc(textFor('btnRemove'))}</button>
      </div>
    `,
      )
      .join('') || `<p class="muted">${esc(textFor('newsSourceAliasEmpty'))}</p>`}
  `;
}

export function openNewsSourceAliasDialogView({ sourceId, state, $, esc, textFor, textForVars }) {
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
  renderNewsSourceAliasDialogView({ state, $, esc, textFor, textForVars });
}

export async function saveNewsSourceAliasesFromDialogView(ctx) {
  const { api, state, textFor, showToast } = ctx;
  const draft = state.newsSourceAliasDraft;
  if (!draft) return;
  const { category: cat, sourceName, aliases } = draft;
  const prev = state.newsSourceSettings?.aliases?.[cat] || {};
  const next = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (String(v || '') === String(sourceName || '')) delete next[k];
  }
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
  closeNewsSourceAliasDialogView({ state, $: ctx.$ });
  renderNewsSourcesView(ctx);
}

export function normalizeNewsSourceIdFromName(name) {
  const s = String(name || '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `src-${h.toString(16)}`;
}

export function syncNewsSourceDraftRowsView({ state }) {
  const inputs = [...document.querySelectorAll('[data-news-source-draft-index]')];
  if (!inputs.length) {
    state.newsSourceDraftRows =
      Array.isArray(state.newsSourceDraftRows) && state.newsSourceDraftRows.length ? state.newsSourceDraftRows : [''];
    return;
  }
  state.newsSourceDraftRows = inputs
    .sort((a, b) => Number(a.dataset.newsSourceDraftIndex) - Number(b.dataset.newsSourceDraftIndex))
    .map((input) => String(input.value || ''));
  if (!state.newsSourceDraftRows.length) state.newsSourceDraftRows = [''];
}

export async function saveNewsSourcesView(ctx) {
  const { api, state, textFor, showToast } = ctx;
  const category = state.newsSourcesCategory || 'global';
  syncNewsSourceDraftRowsView({ state });
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
  next.forEach((s, idx) => {
    s.order = idx + 1;
  });
  state.newsSourceDraftRows = [''];
  await api('/admin/api/news-sources', { method: 'PUT', body: JSON.stringify({ category, items: next }) });
  // After save, always re-fetch through the category/includeHidden filters to avoid
  // temporarily showing merged/legacy rows that the server preserves for safety.
  await loadNewsSourcesView(ctx);
  showToast(textFor('toastSaved') || 'Saved', `${(state.newsSources || []).length}`, { kind: 'success' });
}

