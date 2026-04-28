const newsEditLocales = [
  { locale: 'en', labelKey: 'localeOriginalEnglish' },
  { locale: 'ko', labelKey: 'localeKorean' },
  { locale: 'ja', labelKey: 'localeJapanese' },
];

function newsQueryParams({ state, $, }) {
  const params = new URLSearchParams({
    locale: $('newsLocale').value,
    page: String(state.newsPage),
    pageSize: $('newsPageSize').value,
  });
  for (const [key, id] of [
    ['q', 'newsQuery'],
    ['from', 'newsFrom'],
    ['to', 'newsTo'],
    ['category', 'newsCategory'],
    ['translationStatus', 'newsTranslationStatus'],
  ]) {
    const value = $(id).value.trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

function renderNewsPager({ targetId, state, $, esc, textForVars, textFor }) {
  $(targetId).innerHTML = `
    <div class="muted">${esc(textForVars('pagerSummary', { total: state.newsTotal, page: state.newsPage, pages: state.newsTotalPages }))}</div>
    <div class="row">
      <button class="secondary" data-page="prev">${esc(textFor('btnPrevious'))}</button>
      <button class="secondary" data-page="next">${esc(textFor('btnNext'))}</button>
    </div>
  `;
}

function youtubeQueryParams({ state, $, }) {
  const params = new URLSearchParams({
    page: String(state.youtubePage),
    pageSize: $('youtubePageSize').value,
  });
  for (const [key, id] of [['q', 'youtubeQuery'], ['channel', 'youtubeChannel']]) {
    const value = $(id).value.trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

function renderYoutubePager({ targetId, state, $, esc, textForVars, textFor }) {
  $(targetId).innerHTML = `
    <div class="muted">${esc(textForVars('pagerSummary', { total: state.youtubeTotal, page: state.youtubePage, pages: state.youtubeTotalPages }))}</div>
    <div class="row">
      <button class="secondary" data-youtube-page="prev">${esc(textFor('btnPrevious'))}</button>
      <button class="secondary" data-youtube-page="next">${esc(textFor('btnNext'))}</button>
    </div>
  `;
}

export function selectedNewsIds() {
  return [...document.querySelectorAll('[data-news-id]')].filter((box) => box.checked).map((box) => box.dataset.newsId);
}

export function updateNewsSelectionInfo({ $, textForVars, textFor }) {
  const total = document.querySelectorAll('[data-news-id]').length;
  const selected = selectedNewsIds().length;
  if ($('newsSelectionInfo')) $('newsSelectionInfo').textContent = textForVars('newsSelectedCount', { count: selected });
  if ($('selectPageBtn')) $('selectPageBtn').textContent = selected === total && total > 0 ? textFor('newsSelectPageClear') : textFor('newsSelectPage');
  if ($('retranslateSelectedBtn')) $('retranslateSelectedBtn').disabled = selected === 0;
  if ($('deleteSelectedNewsBtn')) $('deleteSelectedNewsBtn').disabled = selected === 0;
}

export function selectedYoutubeIds() {
  return [...document.querySelectorAll('[data-youtube-id]')].filter((box) => box.checked).map((box) => box.dataset.youtubeId);
}

export function updateYoutubeSelectionInfo({ $, textForVars, textFor }) {
  const total = document.querySelectorAll('[data-youtube-id]').length;
  const selected = selectedYoutubeIds().length;
  if ($('youtubeSelectionInfo')) $('youtubeSelectionInfo').textContent = textForVars('youtubeSelectedCount', { count: selected });
  if ($('selectYoutubePageBtn'))
    $('selectYoutubePageBtn').textContent =
      selected === total && total > 0 ? textFor('youtubeSelectPageClear') : textFor('youtubeSelectPage');
  if ($('refreshSelectedYoutubeBtn')) $('refreshSelectedYoutubeBtn').disabled = selected === 0;
}

function newsTranslationFor(item, locale) {
  return (Array.isArray(item?.translations) ? item.translations : []).find((t) => t.locale === locale) || {};
}

function newsEditValue(item, locale, field) {
  const tr = newsTranslationFor(item, locale);
  if (field === 'title') return tr.title || item.originalTitle || item.title || '';
  if (field === 'summary') return tr.summary || item.originalSummary || item.summary || '';
  return '';
}

export function closeNewsEditDialog({ state, $ }) {
  state.newsEditItemId = '';
  state.newsEditLocale = 'en';
  if ($('newsEditDialog')) $('newsEditDialog').classList.add('hidden');
}

export function renderNewsEditDialog({ state, $, esc, textFor, formatDateTime }) {
  const item = (state.newsRows || []).find((row) => String(row.id) === String(state.newsEditItemId));
  if (!item) {
    closeNewsEditDialog({ state, $ });
    return;
  }
  const locale = state.newsEditLocale || 'en';
  const tr = newsTranslationFor(item, locale);
  const titleValue = newsEditValue(item, locale, 'title');
  const summaryValue = newsEditValue(item, locale, 'summary');
  $('newsEditDialog').classList.remove('hidden');
  $('newsEditDialogTitle').textContent = textFor('newsEditDialogTitle');
  $('newsEditDialogMeta').textContent = `${item.sourceName || '-'} · ${formatDateTime(item.publishedAt)} · ${item.category || '-'}`;
  $('newsEditDialogStatus').textContent = `${locale.toUpperCase()} · ${tr.status || (locale === 'en' ? 'original' : 'missing')}`;
  $('newsEditDialogBody').innerHTML = `
    <div class="newsEditModal">
      <div class="tabs newsEditTabs" role="tablist">
        ${newsEditLocales
          .map(
            (entry) => `
          <button
            type="button"
            class="tabBtn ${entry.locale === locale ? 'active' : ''}"
            data-news-edit-locale="${esc(entry.locale)}">
            ${esc(textFor(entry.labelKey))}
          </button>
        `,
          )
          .join('')}
      </div>
      <div class="newsEditSource">
        <div class="newsEditSourceTitle">${esc(item.originalTitle || item.title || '-')}</div>
        <div class="newsMeta muted">
          ${
            item.sourceUrl
              ? `<a class="developerLink" href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">${esc(textFor('newsOpenOriginal'))}</a>`
              : ''
          }
        </div>
      </div>
      <div class="newsEditGrid">
        <label class="fieldLabel">
          <span>Title</span>
          <textarea id="newsEditTitleInput" class="jsonEditor">${esc(titleValue)}</textarea>
        </label>
        <label class="fieldLabel">
          <span>Summary</span>
          <textarea id="newsEditSummaryInput" class="jsonEditor">${esc(summaryValue)}</textarea>
        </label>
      </div>
    </div>
  `;
}

export function openNewsEditDialog({ id, state, $, esc, textFor, formatDateTime }) {
  state.newsEditItemId = String(id || '');
  state.newsEditLocale = 'en';
  renderNewsEditDialog({ state, $, esc, textFor, formatDateTime });
}

export async function loadYoutubeView(ctx) {
  const { api, $, state, esc, textFor, textForVars, renderTableSkeleton, formatDateTime } = ctx;
  if ($('youtube')) $('youtube').innerHTML = renderTableSkeleton({ cols: 2, rows: 4 });
  const body = await api(`/admin/api/youtube?${youtubeQueryParams({ state, $ })}`);
  state.youtubePage = body.page;
  state.youtubeTotalPages = body.totalPages;
  state.youtubeTotal = body.total;
  if (Array.isArray(body.channels)) {
    const current = $('youtubeChannel').value;
    $('youtubeChannel').innerHTML =
      `<option value="">${esc(textFor('youtubeAllChannels'))}</option>` +
      body.channels
        .map(
          (channel) => `
        <option value="${esc(channel)}">${esc(channel)}</option>
      `,
        )
        .join('');
    $('youtubeChannel').value = current;
  }
  renderYoutubePager({ targetId: 'youtubePagerTop', state, $, esc, textForVars, textFor });
  renderYoutubePager({ targetId: 'youtubePagerBottom', state, $, esc, textForVars, textFor });
  $('youtube').innerHTML =
    body.data
      .map(
        (item) => `
      <div class="card">
        <div class="mediaCard">
          <img class="thumb" src="${esc(item.thumbnailUrl || '')}" alt="" />
          <div>
            <div class="row">
              <input type="checkbox" data-youtube-id="${esc(item.id)}" />
              <span class="pill">${esc(item.channel || '-')}</span>
              <span class="pill">${Number(item.viewCount || 0).toLocaleString()} ${esc(textFor('colYoutubeViews'))}</span>
              <span class="muted">${formatDateTime(item.publishedAt)}</span>
            </div>
            <div class="title">${esc(item.title || '-')}</div>
            <div class="summary">${esc(item.description || '')}</div>
            <div class="row" style="margin-top:8px">
              <a class="developerLink" style="margin:0;padding:0;border:0" href="https://www.youtube.com/watch?v=${esc(item.videoId)}" target="_blank" rel="noreferrer">${esc(textFor('youtubeOpenOnYoutube'))}</a>
            </div>
          </div>
        </div>
      </div>
    `,
      )
      .join('') || `<p class="muted">${esc(textFor('youtubeEmptyFilter'))}</p>`;
  updateYoutubeSelectionInfo({ $, textForVars, textFor });
}

export async function loadNewsView(ctx) {
  const { api, $, state, esc, textFor, textForVars, renderTableSkeleton, formatDateTime } = ctx;
  if ($('news')) $('news').innerHTML = renderTableSkeleton({ cols: 2, rows: 4 });
  const body = await api(`/admin/api/news?${newsQueryParams({ state, $ })}`);
  state.newsPage = body.page;
  state.newsTotalPages = body.totalPages;
  state.newsTotal = body.total;
  state.newsRows = Array.isArray(body.data) ? body.data : [];
  renderNewsPager({ targetId: 'newsPagerTop', state, $, esc, textForVars, textFor });
  renderNewsPager({ targetId: 'newsPagerBottom', state, $, esc, textForVars, textFor });
  $('news').innerHTML =
    state.newsRows.length === 0
      ? `<p class="muted">${esc(textFor('newsEmpty'))}</p>`
      : `
        <div class="card card--elevated">
          <div class="cardHead">
            <div class="cardHeadMain">
              <div class="cardKicker">${esc(textFor('pageNewsTitle'))}</div>
              <div class="cardHint">${esc(textFor('newsListHint'))}</div>
            </div>
          </div>
          <div class="newsTable">
            <table class="newsTableTable">
              <thead>
                <tr>
                  <th style="width:34px"></th>
                  <th style="width:120px">${esc(textFor('newsColTime'))}</th>
                  <th style="width:110px">${esc(textFor('newsColSource'))}</th>
                  <th style="width:92px">${esc(textFor('colCategory'))}</th>
                  <th style="width:92px">${esc(textFor('newsColStatus'))}</th>
                  <th>${esc(textFor('colTitle'))}</th>
                  <th style="width:210px">${esc(textFor('colAction'))}</th>
                </tr>
              </thead>
              <tbody>
                ${state.newsRows
                  .map((item) => {
                    const title = String(item.originalTitle || item.title || '-');
                    const source = String(item.sourceName || '-');
                    const published = formatDateTime(item.publishedAt);
                    const category = String(item.category || '-');
                    const translations = Array.isArray(item.translations) ? item.translations : [];
                    const statusFor = (locale) => translations.find((t) => t.locale === locale)?.status || 'missing';
                    const provider = String(item.provider || '-');
                    return `
                      <tr class="newsRow" data-news-row="${esc(item.id)}">
                        <td><input type="checkbox" data-news-id="${esc(item.id)}" /></td>
                        <td class="muted">${esc(published)}</td>
                        <td><span class="pill">${esc(source)}</span></td>
                        <td><span class="pill">${esc(category)}</span></td>
                        <td>
                          <div class="newsStatusStack">
                            <span class="pill pill--subtle">KO ${esc(statusFor('ko'))}</span>
                            <span class="pill pill--subtle">JA ${esc(statusFor('ja'))}</span>
                          </div>
                        </td>
                        <td>
                          <div class="newsTitle">${esc(title)}</div>
                          <div class="newsMeta muted">${esc(provider)}</div>
                        </td>
                        <td class="tableActions">
                          <button class="secondary" data-news-edit="${esc(item.id)}">${esc(textFor('newsEdit'))}</button>
                          <a class="developerLink" href="${esc(item.sourceUrl || '#')}" target="_blank" rel="noreferrer">${esc(textFor('newsOriginal'))} ↗</a>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
  updateNewsSelectionInfo({ $, textForVars, textFor });
}

