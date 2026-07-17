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
    <div class="card settingsControlCard">
      <div class="settingsFormRow settingsFormRow--spread">
        <div>
          <strong>${esc(textFor('translationFlowTitle'))}</strong>
          <div class="muted cardHint">${esc(textFor('translationFlowHint'))}</div>
          ${
            missingKeys.length
              ? `<div class="muted cardHint"><span class="pill opReconcile">${esc(textFor('providerMissingKeys'))}</span> ${esc(textForVars('providerMissingKeysHint', { providers: missingKeys.join(', ') }))}</div>`
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
              <td>
                <select data-ts-provider="${esc(s.locale)}">
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
      <textarea id="translationTestText" class="settingsTextarea">${esc(textFor('translationDefaultText'))}</textarea>
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

export async function loadAdminUsersView({ api, $, state, esc, textFor, textForVars, formatDateTime }) {
  const body = await api('/admin/api/admin-users');
  const rows = Array.isArray(body.data) ? body.data : [];
  state.adminUsers = rows;
  if (!$('adminUsers')) return;
  $('adminUsers').innerHTML = `
    <div class="settingsSectionGrid">
      <div class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('adminUsersCreateTitle'))}</div>
            <div class="cardHint">${esc(textFor('adminUsersCreateHint'))}</div>
          </div>
        </div>
        <div class="settingsFormRow">
          <input id="adminUserNewId" autocomplete="username" placeholder="${esc(textFor('adminUserIdPh'))}" />
          <input id="adminUserNewPassword" type="password" autocomplete="new-password" placeholder="${esc(textFor('adminUserPasswordPh'))}" />
          <label class="switchRow">
            <input class="switchInput" type="checkbox" id="adminUserNewActive" checked />
            <span class="switchUi" aria-hidden="true"></span>
            <span>${esc(textFor('adminUserActive'))}</span>
          </label>
          <button class="success" id="createAdminUserBtn">${esc(textFor('adminUsersCreateButton'))}</button>
        </div>
      </div>

      <div class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('adminUsersListTitle'))}</div>
            <div class="cardHint">${esc(textForVars('adminUsersListHint', { count: rows.length }))}</div>
          </div>
        </div>
        <table class="settingsTable adminUsersTable">
          <thead>
            <tr>
              <th>${esc(textFor('colName'))}</th>
              <th>${esc(textFor('colStatus'))}</th>
              <th>${esc(textFor('adminUserPasswordReset'))}</th>
              <th>${esc(textFor('colDate'))}</th>
              <th class="center">${esc(textFor('colAction'))}</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `<tr><td colspan="5" class="muted">${esc(textFor('adminUsersEmpty'))}</td></tr>`
                : rows
                    .map(
                      (user) => `
              <tr>
                <td><strong>${esc(user.id)}</strong></td>
                <td>
                  <label class="switchRow">
                    <input class="switchInput" type="checkbox" data-admin-user-active="${esc(user.id)}" ${user.active ? 'checked' : ''} />
                    <span class="switchUi" aria-hidden="true"></span>
                    <span class="pill ${user.active ? 'pillStatus--ok' : 'pillStatus--warn'}">${esc(user.active ? textFor('adminUserActive') : textFor('adminUserInactive'))}</span>
                  </label>
                </td>
                <td>
                  <div class="settingsFormRow settingsFormRow--compact">
                    <input type="password" autocomplete="new-password" data-admin-user-password="${esc(user.id)}" placeholder="${esc(textFor('adminUserPasswordNewPh'))}" />
                    <button class="secondary compactBtn" data-admin-user-password-save="${esc(user.id)}">${esc(textFor('btnChange'))}</button>
                  </div>
                </td>
                <td class="muted">${esc(formatDateTime(user.updatedAt || user.createdAt))}</td>
                <td class="center">
                  <button class="danger compactBtn" data-admin-user-delete="${esc(user.id)}">${esc(textFor('btnRemove'))}</button>
                </td>
              </tr>
            `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function loadLegalTermsView({ api, $, state, esc, textFor, formatDateTime }) {
  const body = await api('/admin/api/legal-terms');
  const rows = Array.isArray(body.data) ? body.data : [];
  state.legalTerms = rows;
  if (!$('legalTerms')) return rows;
  const types = ['service', 'privacy'];
  const locales = ['ko', 'en', 'ja'];
  const activeType = types.includes(state.legalTermType) ? state.legalTermType : 'service';
  const activeLocale = locales.includes(state.legalTermLocale) ? state.legalTermLocale : 'ko';
  state.legalTermType = activeType;
  state.legalTermLocale = activeLocale;
  const activeRows = rows
    .filter((term) => term.type === activeType && term.locale === activeLocale)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const current = activeRows[0] || {
    type: activeType,
    locale: activeLocale,
    version: '',
    title: '',
    body: '',
    required: true,
    active: true,
  };
  const key = `${activeType}:${activeLocale}`;
  const termTitle = activeType === 'service' ? textFor('termsServiceTitle') : textFor('termsPrivacyTitle');
  const localeTitle = textFor(`legalTermsLocale${activeLocale.toUpperCase()}`);
  $('legalTerms').innerHTML = `
    <div class="legalManager">
      <div class="legalNavBar card settingsControlCard">
        <div class="legalNavRow">
          <span class="settingsNavLabel">${esc(textFor('legalTermsTypeTitle'))}</span>
          <div class="segmented legalTypeTabs">
            ${types
              .map(
                (type) => `
                <button type="button" class="secondary segBtn ${type === activeType ? 'active' : ''}" data-legal-type-tab="${esc(type)}">
                  ${esc(type === 'service' ? textFor('termsServiceTitle') : textFor('termsPrivacyTitle'))}
                </button>
              `,
              )
              .join('')}
          </div>
        </div>
        <div class="legalNavRow">
          <span class="settingsNavLabel">${esc(textFor('legalTermsLocaleTitle'))}</span>
          <div class="legalLocaleGrid">
            ${locales
              .map(
                (locale) => `
                  <button type="button" class="secondary legalLocaleBtn ${locale === activeLocale ? 'active' : ''}" data-legal-locale-tab="${esc(locale)}">
                    ${esc(textFor(`legalTermsLocale${locale.toUpperCase()}`))}
                  </button>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>

      <section class="card settingsControlCard legalEditorPanel">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(termTitle)} · ${esc(localeTitle)}</div>
            <div class="cardHint">${esc(textFor('legalTermsLocaleHint'))}</div>
          </div>
          <span class="pill">${esc(current.active ? textFor('statusActive') : textFor('statusInactive'))}</span>
        </div>
        <div class="legalEditorGrid">
          <label class="fieldLabel">${esc(textFor('legalTermsVersionLabel'))}
            <input data-legal-version="${esc(key)}" value="${esc(current.version || '')}" placeholder="${esc(textFor('legalTermsVersionPh'))}" />
          </label>
          <label class="switchRow legalSwitch">
            <input class="switchInput" type="checkbox" data-legal-active="${esc(key)}" ${current.active ? 'checked' : ''}/>
            <span class="switchUi" aria-hidden="true"></span>
            <span>${esc(textFor('colEnabled'))}</span>
          </label>
          <label class="switchRow legalSwitch">
            <input class="switchInput" type="checkbox" data-legal-required="${esc(key)}" ${current.required ? 'checked' : ''}/>
            <span class="switchUi" aria-hidden="true"></span>
            <span>${esc(textFor('legalTermsRequired'))}</span>
          </label>
        </div>
        <label class="fieldLabel">${esc(textFor('legalTermsTitlePh'))}
          <input data-legal-title="${esc(key)}" value="${esc(current.title || '')}" placeholder="${esc(textFor('legalTermsTitlePh'))}" />
        </label>
        <label class="fieldLabel legalBodyField">${esc(textFor('legalTermsEditorTitle'))}
          <textarea data-legal-body="${esc(key)}">${esc(current.body || '')}</textarea>
        </label>
        <div class="legalEditorFoot">
          <span class="muted">${esc(formatDateTime(current.updatedAt))}</span>
          <button class="success" data-legal-save="${esc(key)}">${esc(textFor('btnSave'))}</button>
        </div>
      </section>
    </div>

    <div class="card settingsControlCard">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('legalTermsHistoryTitle'))}</div>
          <div class="cardHint">${esc(textFor('legalTermsHistoryHint'))}</div>
        </div>
      </div>
      <div class="tableScroll">
        <table>
          <thead>
            <tr><th>${esc(textFor('colStatus'))}</th><th>${esc(textFor('colLocale'))}</th><th>${esc(textFor('colTitle'))}</th><th>Version</th><th>${esc(textFor('colDate'))}</th></tr>
          </thead>
          <tbody>
            ${
              activeRows.length
                ? activeRows
                    .map(
                      (term) => `
                        <tr>
                          <td><span class="pill ${term.active ? 'opDone' : ''}">${term.active ? esc(textFor('statusActive')) : esc(textFor('statusInactive'))}</span></td>
                          <td>${esc(term.locale)}</td>
                          <td>${esc(term.title || '-')}</td>
                          <td><code>${esc(term.version || '-')}</code></td>
                          <td>${esc(formatDateTime(term.updatedAt || term.createdAt))}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : `<tr><td colspan="5" class="muted">${esc(textFor('legalTermsHistoryEmpty'))}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
  return rows;
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
  const [body, presetsBody, appSettingsBody, rssSourcesBody] = await Promise.all([
    api('/admin/api/provider-settings'),
    api('/admin/api/ui-model-presets'),
    api('/admin/api/app-settings'),
    api('/admin/api/rss-sources?includeHidden=1'),
  ]);
  const rows = Array.isArray(body.data) ? body.data : [];
  state.providerSettings = rows;
  state.uiModelPresets = presetsBody.data || null;
  state.appSettings = appSettingsBody.data || null;
  state.rssSources = [
    ...(Array.isArray(rssSourcesBody.data) ? rssSourcesBody.data : []),
    ...(Array.isArray(state.rssSourcesDrafts) ? state.rssSourcesDrafts : []),
  ];
  const llm = rows.filter((r) => r.provider === 'openai' || r.provider === 'claude');
  const data = rows.filter((r) => !(r.provider === 'openai' || r.provider === 'claude'));
  const quotesMaxAge = Number(state.appSettings?.marketQuotesMaxAgeSec);
  const quotesMaxAgeValue = Number.isFinite(quotesMaxAge) ? String(quotesMaxAge) : '10';
  const ads = state.appSettings?.ads && typeof state.appSettings.ads === 'object' ? state.appSettings.ads : {};
  const adsEnabled = ads.enabled !== false;
  const sa = state.appSettings?.socialAuth && typeof state.appSettings.socialAuth === 'object' ? state.appSettings.socialAuth : {};
  const g = sa.google || {};
  const a = sa.apple || {};
  const k = sa.kakao || {};
  const n = sa.naver || {};
  const keywordText = (value) => (Array.isArray(value) ? value.join(', ') : String(value || ''));
  const renderRow = (s, { showModel }) => {
    const models = showModel
      ? modelPresetsForProvider({ provider: s.provider, defaultModel: s.defaultModel, uiModelPresets: state.uiModelPresets })
      : [];
    return `
      <div class="providerLine ${showModel ? 'providerLine--llm' : 'providerLine--data'}" data-provider="${esc(s.provider)}">
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
            <div class="cardKicker">${esc(textFor('rssSourcesTitle'))}</div>
            <div class="cardHint">${esc(textFor('rssSourcesHint'))}</div>
          </div>
          <button class="secondary compactBtn" type="button" id="rssSourceAddRow">${esc(textFor('rssSourceAdd'))}</button>
        </div>
        <div class="settingsSectionBody rssSourceSettingsBody">
          <div class="rssSourceHelpGrid">
            <div><strong>${esc(textFor('rssSourceHelpIdentity'))}</strong><span>${esc(textFor('rssSourceHelpIdentityDesc'))}</span></div>
            <div><strong>${esc(textFor('rssSourceHelpFetch'))}</strong><span>${esc(textFor('rssSourceHelpFetchDesc'))}</span></div>
            <div><strong>${esc(textFor('rssSourceHelpFilter'))}</strong><span>${esc(textFor('rssSourceHelpFilterDesc'))}</span></div>
          </div>
          <div class="rssSourceList">
            ${state.rssSources
              .map(
                (source) => `
                  <section class="rssSourceCard" data-rss-source-row="${esc(source.id)}">
                    <div class="rssSourceCardHead">
                      <div>
                        <strong>${esc(source.name || source.id || textFor('rssSourceNamePh'))}</strong>
                        <span>${esc(source.id || '-')}</span>
                      </div>
                      <div class="rssSourceCardActions">
                        <label class="switchRow"><span>${esc(textFor('colEnabled'))}</span><input class="switchInput" type="checkbox" data-rss-source-enabled="${esc(source.id)}" ${source.enabled !== false ? 'checked' : ''}/><span class="switchUi" aria-hidden="true"></span></label>
                        <label class="switchRow"><input class="switchInput" type="checkbox" data-rss-source-hidden="${esc(source.id)}" ${source.hidden === true ? 'checked' : ''}/><span>${esc(textFor('newsSourcesHide'))}</span></label>
                        <button class="danger compactBtn" type="button" data-rss-source-remove="${esc(source.id)}">${esc(textFor('btnDeleteRow'))}</button>
                      </div>
                    </div>
                    <div class="rssSourceFields">
                      <label>
                        <span>${esc(textFor('rssSourceFieldName'))}</span>
                        <input data-rss-source-name="${esc(source.id)}" value="${esc(source.name || '')}" placeholder="${esc(textFor('rssSourceNamePh'))}" />
                        <small>${esc(textFor('rssSourceFieldNameHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceFieldId'))}</span>
                        <input data-rss-source-id="${esc(source.id)}" value="${esc(source.id || '')}" placeholder="financial_juice" />
                        <small>${esc(textFor('rssSourceFieldIdHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceFieldProvider'))}</span>
                        <input data-rss-source-provider="${esc(source.id)}" value="${esc(source.providerId || '')}" placeholder="financial_juice" />
                        <small>${esc(textFor('rssSourceFieldProviderHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceFieldSource'))}</span>
                        <input data-rss-source-source="${esc(source.id)}" value="${esc(source.sourceName || '')}" placeholder="Financial Juice" />
                        <small>${esc(textFor('rssSourceFieldSourceHelp'))}</small>
                      </label>
                      <label class="rssSourceFieldWide">
                        <span>${esc(textFor('rssSourceFeedUrl'))}</span>
                        <input data-rss-source-url="${esc(source.id)}" value="${esc(source.feedUrl || '')}" placeholder="https://..." />
                        <small>${esc(textFor('rssSourceFeedUrlHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('colCategory'))}</span>
                        <select data-rss-source-category="${esc(source.id)}">
                          ${['global', 'korea', 'crypto', 'it', 'earnings', 'filings']
                            .map((category) => `<option value="${esc(category)}" ${source.category === category ? 'selected' : ''}>${esc(category)}</option>`)
                            .join('')}
                        </select>
                        <small>${esc(textFor('rssSourceCategoryHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceDefaultLimit'))}</span>
                        <input data-rss-source-limit="${esc(source.id)}" type="number" min="1" max="100" value="${esc(source.defaultLimit || 40)}" />
                        <small>${esc(textFor('rssSourceDefaultLimitHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceDaysBack'))}</span>
                        <input data-rss-source-days="${esc(source.id)}" type="number" min="0" max="365" value="${esc(source.daysBack || 0)}" />
                        <small>${esc(textFor('rssSourceDaysBackHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceIncludePh'))}</span>
                        <input data-rss-source-include="${esc(source.id)}" value="${esc(keywordText(source.includeKeywords))}" placeholder="${esc(textFor('rssSourceKeywordExample'))}" />
                        <small>${esc(textFor('rssSourceIncludeHelp'))}</small>
                      </label>
                      <label>
                        <span>${esc(textFor('rssSourceExcludePh'))}</span>
                        <input data-rss-source-exclude="${esc(source.id)}" value="${esc(keywordText(source.excludeKeywords))}" placeholder="${esc(textFor('rssSourceKeywordExample'))}" />
                        <small>${esc(textFor('rssSourceExcludeHelp'))}</small>
                      </label>
                    </div>
                  </section>
                `,
              )
              .join('') || `<p class="muted">${esc(textFor('rssSourcesEmpty'))}</p>`}
          </div>
          <div class="row">
            <button class="success" id="rssSourcesSave">${esc(textFor('btnSave'))}</button>
          </div>
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
          <div class="settingsFormRow settingsFormRow--compact settingsFormRow--spaced">
            <div>
              <strong>${esc(textFor('appSettingsAdsTitle'))}</strong>
              <div class="cardHint">${esc(textFor('appSettingsAdsHint'))}</div>
            </div>
            <label class="switchRow">
              <input class="switchInput" id="adsEnabledInput" type="checkbox" ${adsEnabled ? 'checked' : ''} />
              <span class="switchUi" aria-hidden="true"></span>
              <span id="adsEnabledLabel">${esc(adsEnabled ? textFor('appSettingsAdsOn') : textFor('appSettingsAdsOff'))}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="card settingsControlCard">
        <div class="cardHead">
          <div class="cardHeadMain">
            <div class="cardKicker">${esc(textFor('socialAuthCardTitle'))}</div>
            <div class="cardHint">${esc(textFor('socialAuthCardHint'))}</div>
          </div>
          <span class="muted" id="socialAuthSettingsStatus"></span>
        </div>
        <div class="settingsSectionBody">
          <p class="muted cardHint">${esc(textFor('socialAuthSecretsNote'))}</p>
          <label class="fieldLabel">${esc(textFor('socialAuthRedirectPath'))}
            <input id="socialLoginRedirectPath" type="text" value="${esc(String(sa.socialLoginRedirectPath || sa.oauthRedirectPath || 'oauth'))}" />
          </label>
          <div class="socialAuthProviderGrid">
            <div class="socialAuthProviderCard">
              <strong>${esc(textFor('socialAuthGoogle'))}</strong>
              <label class="switchRow socialAuthToggle"><input class="switchInput" type="checkbox" id="socialAuthGoogleEnabled" ${g.enabled === true ? 'checked' : ''} /><span class="switchUi" aria-hidden="true"></span><span>${esc(textFor('socialAuthEnabled'))}</span></label>
              <label class="fieldLabel">webClientId<input id="socialAuthGoogleWeb" type="text" value="${esc(String(g.webClientId || ''))}" /></label>
              <label class="fieldLabel">iosClientId<input id="socialAuthGoogleIos" type="text" value="${esc(String(g.iosClientId || ''))}" /></label>
              <label class="fieldLabel">androidClientId<input id="socialAuthGoogleAndroid" type="text" value="${esc(String(g.androidClientId || ''))}" /></label>
            </div>
            <div class="socialAuthProviderCard">
              <strong>${esc(textFor('socialAuthApple'))}</strong>
              <label class="switchRow socialAuthToggle"><input class="switchInput" type="checkbox" id="socialAuthAppleEnabled" ${a.enabled === true ? 'checked' : ''} /><span class="switchUi" aria-hidden="true"></span><span>${esc(textFor('socialAuthEnabled'))}</span></label>
              <label class="fieldLabel">${esc(textFor('socialAuthAppleBundleId'))}<input id="socialAuthAppleBundle" type="text" value="${esc(String(a.bundleId || a.clientId || ''))}" /></label>
            </div>
            <div class="socialAuthProviderCard">
              <strong>${esc(textFor('socialAuthKakao'))}</strong>
              <label class="switchRow socialAuthToggle"><input class="switchInput" type="checkbox" id="socialAuthKakaoEnabled" ${k.enabled === true ? 'checked' : ''} /><span class="switchUi" aria-hidden="true"></span><span>${esc(textFor('socialAuthEnabled'))}</span></label>
              <label class="fieldLabel">${esc(textFor('socialAuthKakaoRestKey'))}<input id="socialAuthKakaoRest" type="text" value="${esc(String(k.restApiKey || k.clientId || ''))}" /></label>
              <label class="fieldLabel">${esc(textFor('socialAuthKakaoClientSecret'))}<input id="socialAuthKakaoSecret" type="password" autocomplete="new-password" placeholder="${esc(textFor('socialAuthSecretPlaceholder'))}" /></label>
              ${k.clientSecretConfigured ? `<p class="muted socialAuthStoredNote">${esc(textFor('socialAuthSecretStored'))}</p>` : ''}
            </div>
            <div class="socialAuthProviderCard">
              <strong>${esc(textFor('socialAuthNaver'))}</strong>
              <label class="switchRow socialAuthToggle"><input class="switchInput" type="checkbox" id="socialAuthNaverEnabled" ${n.enabled === true ? 'checked' : ''} /><span class="switchUi" aria-hidden="true"></span><span>${esc(textFor('socialAuthEnabled'))}</span></label>
              <label class="fieldLabel">${esc(textFor('socialAuthNaverClientId'))}<input id="socialAuthNaverClient" type="text" value="${esc(String(n.clientId || ''))}" /></label>
              <label class="fieldLabel">${esc(textFor('socialAuthNaverClientSecret'))}<input id="socialAuthNaverSecret" type="password" autocomplete="new-password" placeholder="${esc(textFor('socialAuthSecretPlaceholder'))}" /></label>
              ${n.clientSecretConfigured ? `<p class="muted socialAuthStoredNote">${esc(textFor('socialAuthSecretStored'))}</p>` : ''}
            </div>
          </div>
        </div>
        <div class="cardFoot">
          <button class="success" id="saveSocialAuthSettingsBtn">${esc(textFor('socialAuthSave'))}</button>
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
  if ($('youtubeCurationSettingsStatus') && state.appSettings?.updatedAt) {
    $('youtubeCurationSettingsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.appSettings.updatedAt) });
  }
  if ($('socialAuthSettingsStatus') && state.appSettings?.updatedAt) {
    $('socialAuthSettingsStatus').textContent = textForVars('recentSavedAt', { time: formatDateTime(state.appSettings.updatedAt) });
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
