function uniq(arr) {
  const out = [];
  for (const v of arr || []) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function modelPresetsForProvider({ provider, defaultModel, uiModelPresets }) {
  const p = String(provider || '').trim().toLowerCase();
  const fromSettings = uiModelPresets && typeof uiModelPresets === 'object' ? uiModelPresets[p] : null;
  const base = Array.isArray(fromSettings) ? fromSettings : [];
  return uniq([defaultModel, ...base]);
}

export function defaultModelForProvider({ provider, providerSettings, uiModelPresets }) {
  const p = String(provider || '').trim().toLowerCase();
  const configured = (providerSettings || []).find((x) => x.provider === p)?.defaultModel || '';
  const presets = modelPresetsForProvider({ provider: p, defaultModel: configured, uiModelPresets });
  return configured || presets[0] || '';
}

function renderModelOptions({ options, selected, esc }) {
  const sel = String(selected || '');
  return (options || [])
    .map((m) => `<option value="${esc(m)}" ${m === sel ? 'selected' : ''}>${esc(m)}</option>`)
    .join('');
}

export function refreshTranslationTestModels({ providerSettings, uiModelPresets, $, esc }) {
  const provider = $('translationTestProvider')?.value || 'mock';
  const defaultModel = (providerSettings || []).find((p) => p.provider === provider)?.defaultModel || '';
  const models = modelPresetsForProvider({ provider, defaultModel, uiModelPresets });
  const current = $('translationTestModel')?.value || '';
  if ($('translationTestModel')) {
    $('translationTestModel').innerHTML =
      models.length > 0
        ? renderModelOptions({
            options: models,
            selected: models.includes(current) ? current : defaultModel || models[0],
            esc,
          })
        : '<option value="">-</option>';
  }
}

export async function loadTranslationSettingsView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime, switchView } = ctx;

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
  const missingKeys = [!openaiInfo?.hasApiKey ? 'OpenAI' : null, !claudeInfo?.hasApiKey ? 'Claude' : null].filter(Boolean);
  const modelLabelForProvider = (provider) =>
    defaultModelForProvider({ provider, providerSettings: providers, uiModelPresets: state.uiModelPresets }) ||
    textFor('providerDefaultModelNone');

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
          ${
            missingKeys.length
              ? `<div class="muted" style="margin-top:6px"><span class="pill opReconcile">${esc(textFor('providerMissingKeys'))}</span> ${esc(textForVars('providerMissingKeysHint', { providers: missingKeys.join(', ') }))}</div>`
              : ''
          }
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
          ${rows
            .map(
              (s) => `
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
          `,
            )
            .join('')}
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

  refreshTranslationTestModels({ providerSettings: providers, uiModelPresets: state.uiModelPresets, $, esc });
  if ($('translationTestProvider')) {
    $('translationTestProvider').addEventListener('change', () =>
      refreshTranslationTestModels({ providerSettings: providers, uiModelPresets: state.uiModelPresets, $, esc }),
    );
  }
}

export async function loadUiModelPresetsView({ api, state, renderUiModelPresetsEditor }) {
  const body = await api('/admin/api/ui-model-presets');
  state.uiModelPresets = body.data || null;
  renderUiModelPresetsEditor();
}

function presetsTextareaValue({ state, key }) {
  const list = state.uiModelPresets && Array.isArray(state.uiModelPresets[key]) ? state.uiModelPresets[key] : [];
  return list.join('\n');
}

export function renderUiModelPresetsEditorView({ $, state, esc, textFor, textForVars, formatDateTime }) {
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
          <textarea id="uiPresetOpenai" class="jsonEditor">${esc(presetsTextareaValue({ state, key: 'openai' }))}</textarea>
        </label>
        <label class="fieldLabel modelPresetCard">Claude
          <textarea id="uiPresetClaude" class="jsonEditor">${esc(presetsTextareaValue({ state, key: 'claude' }))}</textarea>
        </label>
        <label class="fieldLabel modelPresetCard">mock
          <textarea id="uiPresetMock" class="jsonEditor">${esc(presetsTextareaValue({ state, key: 'mock' }))}</textarea>
        </label>
      </div>
      <div class="cardFoot">
        <button class="success" id="saveUiModelPresets">${esc(textFor('btnSave'))}</button>
      </div>
    </div>
  `;
  if ($('uiModelPresetsStatus') && state.uiModelPresets?.updatedAt) {
    $('uiModelPresetsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.uiModelPresets.updatedAt) });
  }
}

export async function loadProviderSettingsView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime, renderUiModelPresetsEditor } = ctx;
  const [body, presetsBody, appSettingsBody] = await Promise.all([
    api('/admin/api/provider-settings'),
    api('/admin/api/ui-model-presets'),
    api('/admin/api/app-settings'),
  ]);
  const rows = Array.isArray(body.data) ? body.data : [];
  state.providerSettings = rows;
  state.uiModelPresets = presetsBody.data || null;
  state.appSettings = appSettingsBody.data || null;
  const llm = rows.filter((r) => r.provider === 'openai' || r.provider === 'claude');
  const data = rows.filter((r) => !(r.provider === 'openai' || r.provider === 'claude'));
  const quotesMaxAge = Number(state.appSettings?.marketQuotesMaxAgeSec);
  const quotesMaxAgeValue = Number.isFinite(quotesMaxAge) ? String(quotesMaxAge) : '10';
  const renderRow = (s, { showModel }) => {
    const models = showModel
      ? modelPresetsForProvider({ provider: s.provider, defaultModel: s.defaultModel, uiModelPresets: state.uiModelPresets })
      : [];
    return `
      <div class="providerTile ${showModel ? 'providerTile--llm' : 'providerTile--data'}" data-provider="${esc(s.provider)}">
        <div class="providerTileHead">
          <span class="providerGlyph">${showModel ? 'AI' : 'API'}</span>
          <div class="providerTitle">
            <strong>${esc(s.provider)}</strong>
            <span class="muted">${esc(showModel ? textFor('providerLlmSubtitle') : textFor('providerDataSubtitle'))}</span>
          </div>
          <span class="pill ${s.hasApiKey ? 'pillStatus--ok' : 'pillStatus--warn'}">${esc(
            s.hasApiKey ? textForVars('providerConfigured', { key: s.maskedApiKey }) : textFor('providerKeyMissing'),
          )}</span>
          <label class="switchRow providerSwitch providerSwitch--head">
            <input class="switchInput" type="checkbox" data-provider-enabled="${esc(s.provider)}" ${s.enabled ? 'checked' : ''}/>
            <span class="switchUi" aria-hidden="true"></span>
          </label>
          <button class="secondary compactBtn" type="button" data-provider-edit-open="${esc(s.provider)}">${esc(textFor('btnEdit'))}</button>
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

      <div class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('appSettingsQuotesTitle'))}</div>
            <div class="cardHint">${esc(textFor('appSettingsQuotesHint'))}</div>
          </div>
          <span class="muted" id="appSettingsStatus"></span>
        </div>
        <div class="settingsSectionBody">
          <label class="fieldLabel">
            ${esc(textFor('appSettingsQuotesMaxAgeLabel'))}
            <div class="row">
              <input id="marketQuotesMaxAgeSecInput" type="number" min="0" max="300" step="1" value="${esc(quotesMaxAgeValue)}" />
              <span class="muted">${esc(textFor('appSettingsQuotesSecondsUnit'))}</span>
              <button class="success" id="saveAppSettingsBtn">${esc(textFor('btnSave'))}</button>
            </div>
          </label>
        </div>
      </div>
    </div>
  `;
  renderUiModelPresetsEditor();
  if ($('uiModelPresetsStatus') && state.uiModelPresets?.updatedAt) {
    $('uiModelPresetsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.uiModelPresets.updatedAt) });
  }
  if ($('appSettingsStatus') && state.appSettings?.updatedAt) {
    $('appSettingsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.appSettings.updatedAt) });
  }
}

export async function loadMarketListsView(ctx) {
  const { api, $, state, esc, textFor, textForVars, formatDateTime } = ctx;
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
        ${
          lists.length === 0
            ? `<p class="muted">${esc(textFor('marketListsEmpty'))}</p>`
            : lists
                .map(
                  (list) => `
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
        `,
                )
                .join('')
        }
      </div>
    </div>
  `;
}

