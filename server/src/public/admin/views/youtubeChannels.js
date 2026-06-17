/** 브라우저 어드민용 — 서버 `youtubeCuration.mjs` 와 동일 규칙 (서버 모듈 import 금지) */
function normalizeYoutubeHandle(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  const urlHandle = raw.match(/(?:youtube\.com|youtu\.be)\/@([^/?#\s]+)/i)?.[1];
  if (urlHandle) raw = urlHandle;
  raw = raw.replace(/^@+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  raw = raw.split('/').filter(Boolean).pop() || raw;
  return raw.replace(/[^A-Za-z0-9._-]/g, '').trim();
}

export function youtubeChannelIdFromDraftHandle(handle) {
  const h = normalizeYoutubeHandle(handle);
  return h ? `yt-${h.toLowerCase()}` : '';
}

export function renderYoutubeChannelsView(ctx) {
  const { $, state, esc, textFor, textForVars } = ctx;
  const host = $('youtubeChannels');
  if (!host) return;
  const rows = [...(state.youtubeChannels || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0) || String(a.handle).localeCompare(String(b.handle)),
  );
  const draftRows =
    Array.isArray(state.youtubeChannelDraftRows) && state.youtubeChannelDraftRows.length
      ? state.youtubeChannelDraftRows
      : [''];
  host.innerHTML = `
    <div class="card settingsControlCard">
      <div class="cardHead">
        <div class="cardHeadMain">
          <div class="cardKicker">${esc(textFor('youtubeChannelsTitle'))}</div>
          <div class="cardHint">${esc(textFor('youtubeChannelsHint'))}</div>
        </div>
        <div class="cardHeadActions">
          <button class="secondary" id="refreshYoutubeChannelsBtn">${esc(textFor('btnRefresh'))}</button>
        </div>
      </div>
      <div class="newsSourcesWorkspace">
        <div class="newsSourcesMain">
          <div class="newsSourcesTable">
            <div class="sourceListHead">
              <div>
                <div class="cardKicker">${esc(textFor('youtubeChannelListTitle'))}</div>
                <div class="cardHint">${esc(textForVars('youtubeChannelListHint', { count: rows.length }))}</div>
              </div>
            </div>
            <div class="sourceControlBlock sourceControlBlock--wide sourcePolicyInline">
              <label class="switchRow">
                <input class="switchInput" type="checkbox" id="youtubeChannelsShowHidden" ${state.youtubeChannelsShowHidden ? 'checked' : ''} />
                <span class="switchUi" aria-hidden="true"></span>
                <span class="switchLabel">${esc(textFor('youtubeChannelsShowHidden'))}</span>
              </label>
            </div>
            <table class="settingsTable sourceTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>${esc(textFor('colHandle'))}</th>
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
                    <td><strong>${esc(s.handle)}</strong>${s.hidden ? ` <span class="pill">${esc(textFor('youtubeChannelsHide'))}</span>` : ''}</td>
                    <td><label class="switchRow switchRow--compact"><input class="switchInput" type="checkbox" data-youtube-channel-enabled="${esc(s.id)}" ${s.enabled ? 'checked' : ''} ${s.hidden ? 'disabled' : ''}/><span class="switchUi" aria-hidden="true"></span></label></td>
                    <td class="muted">${Number(s.order) || idx + 1}</td>
                    <td class="tableActions">
                      <button class="iconBtn" title="Move up" data-youtube-channel-move="up" data-youtube-channel-id="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>↑</button>
                      <button class="iconBtn" title="Move down" data-youtube-channel-move="down" data-youtube-channel-id="${esc(s.id)}" ${s.hidden ? 'disabled' : ''}>↓</button>
                      <button class="secondary compactBtn" data-youtube-channel-toggle-hidden="${esc(s.id)}">${esc(
                        s.hidden ? textFor('youtubeChannelsUnhide') : textFor('youtubeChannelsHide'),
                      )}</button>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
            ${rows.length === 0 ? `<p class="muted">${esc(textFor('youtubeChannelsEmpty'))}</p>` : ''}
            <div class="sourceDraftPanel">
              <div class="sourceDraftHead">
                <div>
                  <div class="sourceControlLabel">${esc(textFor('youtubeChannelAddTitle'))}</div>
                  <div class="cardHint">${esc(textFor('youtubeChannelAddHint'))}</div>
                </div>
                <button class="iconBtn" id="addYoutubeChannelDraftRow" title="${esc(textFor('youtubeChannelAddTitle'))}">+</button>
              </div>
              <div class="sourceDraftRows">
                ${draftRows
                  .map(
                    (value, idx) => `
                  <div class="sourceDraftRow">
                    <span class="muted">${idx + 1}</span>
                    <input class="newsSourcesAddInput" data-youtube-channel-draft-index="${idx}" placeholder="${esc(textFor('youtubeChannelAddPh'))}" value="${esc(value || '')}" />
                    <button class="danger compactBtn" data-youtube-channel-draft-remove="${idx}" ${draftRows.length <= 1 ? 'disabled' : ''}>${esc(textFor('btnRemove'))}</button>
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
        <button class="success" id="saveYoutubeChannelsBtn">${esc(textFor('btnSave'))}</button>
      </div>
    </div>
  `;
}

export async function loadYoutubeChannelsView(ctx) {
  const { api, state } = ctx;
  const includeHidden = state.youtubeChannelsShowHidden ? '?includeHidden=1' : '';
  const body = await api(`/admin/api/youtube-channels${includeHidden}`);
  state.youtubeChannels = Array.isArray(body.data) ? body.data : [];
  renderYoutubeChannelsView(ctx);
}

export function syncYoutubeChannelDraftRowsView({ state }) {
  const inputs = [...document.querySelectorAll('[data-youtube-channel-draft-index]')];
  if (!inputs.length) {
    state.youtubeChannelDraftRows =
      Array.isArray(state.youtubeChannelDraftRows) && state.youtubeChannelDraftRows.length
        ? state.youtubeChannelDraftRows
        : [''];
    return;
  }
  state.youtubeChannelDraftRows = inputs
    .sort((a, b) => Number(a.dataset.youtubeChannelDraftIndex) - Number(b.dataset.youtubeChannelDraftIndex))
    .map((input) => String(input.value || ''));
  if (!state.youtubeChannelDraftRows.length) state.youtubeChannelDraftRows = [''];
}

export async function saveYoutubeChannelsView(ctx) {
  const { api, state, textFor, showToast } = ctx;
  syncYoutubeChannelDraftRowsView({ state });
  const next = [...(state.youtubeChannels || [])]
    .map((s, idx) => ({
      id: String(s.id || '').trim(),
      handle: normalizeYoutubeHandle(s.handle),
      title: String(s.title || '').trim() || `@${normalizeYoutubeHandle(s.handle)}`,
      enabled: s.enabled !== false,
      hidden: !!s.hidden,
      order: idx + 1,
    }))
    .filter((s) => s.id && s.handle);
  const seenIds = new Set(next.map((s) => s.id));
  const seenHandles = new Set(next.map((s) => s.handle.toLowerCase()));
  for (const rawHandle of state.youtubeChannelDraftRows || []) {
    const handle = normalizeYoutubeHandle(rawHandle);
    if (!handle) continue;
    const id = youtubeChannelIdFromDraftHandle(handle);
    const lower = handle.toLowerCase();
    if (seenIds.has(id) || seenHandles.has(lower)) continue;
    next.push({
      id,
      handle,
      title: `@${handle}`,
      enabled: true,
      hidden: false,
      order: next.length + 1,
    });
    seenIds.add(id);
    seenHandles.add(lower);
  }
  next.forEach((s, idx) => {
    s.order = idx + 1;
  });
  state.youtubeChannelDraftRows = [''];
  await api('/admin/api/youtube-channels', { method: 'PUT', body: JSON.stringify({ items: next }) });
  await loadYoutubeChannelsView(ctx);
  showToast(textFor('toastSaved') || 'Saved', `${(state.youtubeChannels || []).length}`, { kind: 'success' });
}
