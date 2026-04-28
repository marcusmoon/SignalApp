export function normalizeSymbolInput(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function renderMarketListDialogView(ctx) {
  const { $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  const draft = state.marketListDraft;
  if (!draft) {
    $('marketListDialog').classList.add('hidden');
    return;
  }
  $('marketListDialog').classList.remove('hidden');
  $('marketListDialogTitle').textContent = textForVars('marketListEditTitle', { name: draft.displayName });
  $('marketListDialogMeta').textContent = textForVars('marketListEditMetaLine', {
    key: draft.key,
    time: formatDateTime(draft.updatedAt),
  });
  $('marketListDialogName').value = draft.displayName;
  $('marketListDialogDesc').value = draft.description || '';
  $('marketListDialogCount').textContent = textForVars('marketListSymbolTotal', { n: draft.symbols.length });
  $('marketListSymbolRows').innerHTML =
    draft.symbols
      .map(
        (symbol, index) => `
      <div class="symbolRow">
        <span class="muted">${index + 1}</span>
        <input data-market-symbol-index="${index}" value="${esc(symbol)}" />
        <button class="danger" data-market-symbol-delete="${index}">${esc(textFor('btnDeleteRow'))}</button>
      </div>
    `,
      )
      .join('') || `<p class="muted">${esc(textFor('marketListSymbolsEmpty'))}</p>`;
}

export function openMarketListDialogView(ctx) {
  const { key, $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  const list = (state.marketLists || []).find((item) => item.key === key);
  if (!list) return;
  state.marketListDraft = {
    ...list,
    symbols: [...(list.symbols || [])],
  };
  $('marketListAddSymbol').value = '';
  renderMarketListDialogView({ $, state, esc, textFor, textForVars, formatDateTime });
}

export function closeMarketListDialogView(ctx) {
  const { $, state, esc, textFor, textForVars, formatDateTime } = ctx;
  state.marketListDraft = null;
  renderMarketListDialogView({ $, state, esc, textFor, textForVars, formatDateTime });
}

export function syncMarketListDraftFromInputsView({ state, $ }) {
  if (!state.marketListDraft) return;
  state.marketListDraft.displayName = $('marketListDialogName').value.trim() || state.marketListDraft.key;
  state.marketListDraft.description = $('marketListDialogDesc').value.trim();
  state.marketListDraft.symbols = [...document.querySelectorAll('[data-market-symbol-index]')]
    .map((input) => normalizeSymbolInput(input.value))
    .filter(Boolean);
}

