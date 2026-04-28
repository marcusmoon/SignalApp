export function openErrorDetailDialogView(ctx) {
  const {
    key,
    $,
    textFor,
    textForVars,
    esc,
    formatDateTime,
    formatDuration,
    runRowByKey,
    operationBadge,
    domainBadge,
    providerBadge,
  } = ctx;

  const run = runRowByKey(key);
  if (!run) return;
  $('errorDetailDialog').classList.remove('hidden');
  $('errorDetailDialogTitle').textContent = textFor('errorDetailTitle');
  $('errorDetailDialogMeta').textContent = textForVars('errorDetailMeta', {
    job: run.displayName || run.jobKey || '-',
    status: run.status || '-',
    time: formatDateTime(run.finishedAt || run.startedAt),
  });
  $('errorDetailDialogBody').innerHTML = `
    <div class="errorDetailBody">
      <section class="errorDetailSection">
        <div class="cardKicker">${esc(textFor('errorDetailMessage'))}</div>
        <pre class="errorDetailMessage">${esc(run.errorMessage || '-')}</pre>
      </section>
      <section class="errorDetailSection">
        <div class="cardKicker">${esc(textFor('errorDetailContext'))}</div>
        <div class="errorDetailGrid">
          <span>${esc(textFor('colJob'))}</span><strong>${esc(run.displayName || run.jobKey || '-')}</strong>
          <span>jobKey</span><code>${esc(run.jobKey || '-')}</code>
          <span>${esc(textFor('colOperation'))}</span><div>${operationBadge(run.operation)}</div>
          <span>${esc(textFor('colDomain'))}</span><div>${domainBadge(run.domain || run.resultKind)}</div>
          <span>${esc(textFor('colProvider'))}</span><div>${providerBadge(run.provider)}</div>
          <span>${esc(textFor('colTrigger'))}</span><strong>${esc(run.trigger || '-')}</strong>
          <span>${esc(textFor('colItems'))}</span><strong>${esc(run.itemCount ?? 0)}</strong>
          <span>${esc(textFor('colDuration'))}</span><strong>${esc(formatDuration(run.durationMs))}</strong>
          <span>${esc(textFor('colStarted'))}</span><strong>${esc(formatDateTime(run.startedAt))}</strong>
          <span>${esc(textFor('colFinished'))}</span><strong>${esc(formatDateTime(run.finishedAt))}</strong>
        </div>
      </section>
    </div>
  `;
}

export function closeErrorDetailDialogView({ $ }) {
  $('errorDetailDialog')?.classList.add('hidden');
}

