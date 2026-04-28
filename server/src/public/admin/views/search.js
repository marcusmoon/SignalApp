export function createSearchIndex() {
  return { builtAt: 0, items: [] };
}

export function buildSearchIndexView({ searchIndex, state, jobDisplayName, switchView, setJobTab }) {
  const items = [];
  document.querySelectorAll('[data-view]').forEach((btn) => {
    const view = btn.getAttribute('data-view');
    const label = btn.textContent?.trim();
    if (!view || !label) return;
    items.push({ kind: 'menu', label, detail: 'menu', action: () => switchView(view) });
  });
  for (const job of state.jobs || []) {
    const label = jobDisplayName(job);
    items.push({
      kind: 'job',
      label,
      detail: job.jobKey,
      action: async () => {
        await switchView('jobs');
        setJobTab('info');
      },
    });
  }
  searchIndex.items = items;
  searchIndex.builtAt = Date.now();
}

export function renderSearchResultsView({ q, searchIndex, esc, textFor }) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return `<div class="muted">${esc(textFor('searchPrompt'))}</div>`;
  const hits = (searchIndex.items || [])
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => `${it.label} ${it.detail}`.toLowerCase().includes(query))
    .slice(0, 24);
  if (hits.length === 0) return `<div class="muted">${esc(textFor('searchNoHits'))}</div>`;
  return hits
    .map(
      ({ it, index }) => `
      <button class="secondary" style="width:100%;text-align:left" data-search-hit="${index}">
        <strong>${esc(it.label)}</strong><br/>
        <span class="muted">${esc(it.detail || it.kind)}</span>
      </button>
    `,
    )
    .join('');
}

