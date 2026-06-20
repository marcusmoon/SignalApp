function pad2(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(2, '0');
}

function ymdFromParts(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function calendarMonthMeta(ym) {
  const parts = String(ym || '').split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const first = ymdFromParts(y, m, 1);
  const last = ymdFromParts(y, m, daysInMonth(y, m));
  return { y, m, first, last };
}

export function shiftCalendarMonth(ym, delta) {
  const meta = calendarMonthMeta(ym);
  if (!meta) return ym;
  let { y, m } = meta;
  m += delta;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${pad2(m)}`;
}

export function initCalendarMonthIfNeeded({ state, ymd }) {
  if (state.calendarMonthYm) return;
  const t = new Date();
  state.calendarMonthYm = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
  state.calendarSelectedYmd = ymd(t);
}

function adminBcp47() {
  const lang = localStorage.getItem('signalAdminLanguage') || 'ko';
  if (lang === 'en') return 'en-US';
  if (lang === 'ja') return 'ja-JP';
  return 'ko-KR';
}

function formatAdminCalendarDayHeading(ymdValue) {
  try {
    const v = String(ymdValue || '').slice(0, 10);
    const [y, m, d] = v.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return v;
    return new Date(y, m - 1, d).toLocaleDateString(adminBcp47(), { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(ymdValue || '');
  }
}

function calendarEventTable({ rows, esc, textFor }) {
  return `
    <table class="calendarEventsTable">
      <thead>
        <tr>
          <th>${esc(textFor('colDate'))}</th>
          <th>${esc(textFor('colType'))}</th>
          <th>${esc(textFor('colTitle'))}</th>
          <th>${esc(textFor('colMeta'))}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (item) => `
          <tr>
            <td class="muted">${esc(item.date || '-')}</td>
            <td><span class="pill">${esc(item.type || '-')}</span></td>
            <td><strong>${esc(item.title || '-')}</strong></td>
            <td class="muted">${esc(item.country || item.symbol || '-')}</td>
            <td>
              <button type="button" class="secondary compactBtn" data-edit-calendar-event="${esc(item.id)}">수정</button>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function draftFromEvent(item = {}) {
  return {
    id: item.id || '',
    date: String(item.date || '').slice(0, 10),
    type: item.type || 'macro',
    country: item.country || 'US',
    title: item.title || '',
    symbol: item.symbol || '',
    timeLabel: item.timeLabel || '',
    timezone: item.timezone || '',
    impact: item.impact || '',
    actual: item.actual ?? '',
    estimate: item.estimate ?? '',
    previous: item.previous ?? '',
    unit: item.unit || '',
    provider: item.provider || 'admin',
    source: item.source || 'admin',
    sourceEventId: item.sourceEventId || item.providerItemId || '',
    url: item.url || '',
  };
}

function emptyCalendarDraft(state) {
  const selected = String(state.calendarSelectedYmd || state.calendarRangeFocusYmd || '').slice(0, 10);
  const fallback = selected && selected !== '__all__' ? selected : new Date().toISOString().slice(0, 10);
  return draftFromEvent({ date: fallback, type: 'macro', country: 'US', provider: 'admin', source: 'admin' });
}

function calendarEventEditor({ state, esc }) {
  const draft = state.calendarEventDraft || emptyCalendarDraft(state);
  return `
    <div class="filterBar filterBox" style="margin-bottom:12px">
      <div class="filterBarControls jobsFilterGroups">
        <div class="filterGroup">
          <span class="filterGroupTitle">날짜</span>
          <input id="calendarEventDate" type="date" value="${esc(draft.date || '')}" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">타입</span>
          <select id="calendarEventType">
            ${['macro', 'earnings', 'holiday', 'fomc', 'fed'].map((type) => `<option value="${type}"${draft.type === type ? ' selected' : ''}>${type}</option>`).join('')}
          </select>
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">국가</span>
          <input id="calendarEventCountry" value="${esc(draft.country || '')}" placeholder="US / KR" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">종목</span>
          <input id="calendarEventSymbol" value="${esc(draft.symbol || '')}" placeholder="AAPL" />
        </div>
        <div class="filterGroup filterGroup--search">
          <span class="filterGroupTitle">제목</span>
          <input id="calendarEventTitle" class="wide" value="${esc(draft.title || '')}" placeholder="CPI YoY" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">시간</span>
          <input id="calendarEventTimeLabel" value="${esc(draft.timeLabel || '')}" placeholder="08:30 ET" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">중요도</span>
          <select id="calendarEventImpact">
            <option value=""${!draft.impact ? ' selected' : ''}>-</option>
            ${['low', 'medium', 'high'].map((impact) => `<option value="${impact}"${draft.impact === impact ? ' selected' : ''}>${impact}</option>`).join('')}
          </select>
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">실제</span>
          <input id="calendarEventActual" type="number" step="0.01" value="${esc(draft.actual ?? '')}" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">예상</span>
          <input id="calendarEventEstimate" type="number" step="0.01" value="${esc(draft.estimate ?? '')}" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">이전</span>
          <input id="calendarEventPrevious" type="number" step="0.01" value="${esc(draft.previous ?? '')}" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">단위</span>
          <input id="calendarEventUnit" value="${esc(draft.unit || '')}" placeholder="%" />
        </div>
        <div class="filterGroup filterGroup--search">
          <span class="filterGroupTitle">출처 ID</span>
          <input id="calendarEventSourceEventId" value="${esc(draft.sourceEventId || '')}" placeholder="optional" />
          <button type="button" id="newCalendarEventBtn" class="secondary">새 이벤트</button>
          <button type="button" id="saveCalendarEventBtn" class="primary">${draft.id ? '수정 저장' : '등록'}</button>
          ${draft.id ? `<button type="button" id="deleteCalendarEventBtn" class="secondary dangerText">삭제</button>` : ''}
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0">저장 시 국가·타입·매핑 규칙 기준으로 event key가 재계산됩니다. 날짜/제목/타입을 바꾸면 기존 이벤트는 삭제 후 새 이벤트로 저장됩니다.</p>
    </div>
  `;
}

function renderCalendarEventEditor({ state, $, esc }) {
  const host = $('calendarEventEditor');
  if (!host) return;
  host.innerHTML = calendarEventEditor({ state, esc });
}

function renderCalendarJobRunner({ state, $, esc }) {
  const host = $('calendarJobRunner');
  if (!host) return;
  const jobs = Array.isArray(state.calendarJobs) ? state.calendarJobs : [];
  host.innerHTML = jobs.length === 0
    ? '<p class="muted">캘린더 영역에 연결된 Job이 없습니다.</p>'
    : `
      <div class="mobileRunList">
        ${jobs
          .map(
            (job) => `
              <article class="mobileRunCard">
                <div class="mobileRunCardHead">
                  <strong>${esc(job.displayName || job.jobKey)}</strong>
                  <span class="pill">${job.enabled ? 'enabled' : 'disabled'}</span>
                </div>
                <div class="mobileRunStats">
                  <span>주기 <strong>${esc(String(job.intervalSeconds || 0))}s</strong></span>
                  <span>최근 <strong>${esc(job.latestRunStatus || '-')}</strong></span>
                </div>
                <div class="row" style="margin-top:10px">
                  <button type="button" class="success compactBtn" data-calendar-job-run="${esc(job.jobKey)}">수동 실행</button>
                  <button type="button" class="secondary compactBtn" data-open-job-log="${esc(job.jobKey)}">이력</button>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    `;
}

function calendarEventCards({ rows, esc, textFor }) {
  return `
    <div class="mobileCalendarList">
      ${rows
        .map(
          (item) => `
        <article class="mobileCalendarCard">
          <div class="mobileCalendarCardHead">
            <strong>${esc(item.title || '-')}</strong>
            <span class="pill">${esc(item.type || '-')}</span>
          </div>
          <div class="mobileRunStats">
            <span>${esc(textFor('colDate'))} <strong>${esc(item.date || '-')}</strong></span>
            <span>${esc(textFor('colMeta'))} <strong>${esc(item.country || item.symbol || '-')}</strong></span>
          </div>
        </article>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderCalendarEventCodeMappings({ state, $, esc }) {
  const host = $('calendarEventCodeMappings');
  if (!host) return;
  const rows = Array.isArray(state.calendarEventCodeMappings) ? state.calendarEventCodeMappings : [];
  host.innerHTML = `
    <div class="filterBar filterBox" style="margin-bottom:12px">
      <div class="filterBarControls jobsFilterGroups">
        <div class="filterGroup">
          <span class="filterGroupTitle">타입</span>
          <select id="calendarMappingEventType">
            <option value="macro">macro</option>
            <option value="fomc">fomc</option>
            <option value="fed">fed</option>
          </select>
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">코드</span>
          <input id="calendarMappingCode" placeholder="cpi-yoy" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">이름</span>
          <input id="calendarMappingLabel" placeholder="CPI YoY" />
        </div>
        <div class="filterGroup">
          <span class="filterGroupTitle">매칭</span>
          <select id="calendarMappingMatchType">
            <option value="contains">contains</option>
            <option value="regex">regex</option>
            <option value="exact">exact</option>
            <option value="slug">slug</option>
          </select>
        </div>
        <div class="filterGroup filterGroup--search">
          <span class="filterGroupTitle">패턴</span>
          <input id="calendarMappingPattern" class="wide" placeholder="consumer price index" />
          <button type="button" id="saveCalendarMappingBtn" class="primary">추가</button>
        </div>
      </div>
      <p class="muted" style="margin:8px 0 0">macro/fomc/fed 이벤트의 제목을 안정적인 event key로 묶는 규칙입니다. holiday는 국가+날짜, earnings는 종목+날짜로 자동 묶습니다.</p>
    </div>
    <table class="calendarEventsTable">
      <thead>
        <tr>
          <th>타입</th>
          <th>코드</th>
          <th>이름</th>
          <th>매칭</th>
          <th>패턴</th>
          <th>우선순위</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td><span class="pill">${esc(row.eventType || '-')}</span></td>
                <td><strong>${esc(row.code || '-')}</strong></td>
                <td>${esc(row.label || '-')}</td>
                <td class="muted">${esc(row.matchType || '-')}</td>
                <td class="muted">${esc(row.pattern || '-')}</td>
                <td class="muted">${esc(row.priority ?? '-')}</td>
                <td><button type="button" class="secondary dangerText" data-delete-calendar-mapping="${esc(row.id)}">삭제</button></td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderCalendarSummary({ state, $, esc, textFor }) {
  const host = $('calendarSummary');
  if (!host) return;
  const rows = Array.isArray(state.calendarMonthRows) ? state.calendarMonthRows : [];
  const uniqueDates = new Set(rows.map((row) => String(row.date || '').slice(0, 10)).filter(Boolean));
  const earnings = rows.filter((row) => row.type === 'earnings').length;
  const macro = rows.filter((row) => row.type && row.type !== 'earnings').length;
  host.innerHTML = `
    <div class="calendarSummaryItem">
      <span>${esc(textFor('calendarSummaryTotal'))}</span>
      <strong>${rows.length}</strong>
    </div>
    <div class="calendarSummaryItem">
      <span>${esc(textFor('calendarSummaryDates'))}</span>
      <strong>${uniqueDates.size}</strong>
    </div>
    <div class="calendarSummaryItem">
      <span>${esc(textFor('calendarSummaryEarnings'))}</span>
      <strong>${earnings}</strong>
    </div>
    <div class="calendarSummaryItem">
      <span>${esc(textFor('calendarSummaryMacro'))}</span>
      <strong>${macro}</strong>
    </div>
  `;
}

export function renderAdminCalendarGrid({ state, $, esc, textFor, ymd }) {
  const host = $('adminCalendarGrid') || $('calendarGrid');
  if (!host) return;
  const meta = calendarMonthMeta(state.calendarMonthYm);
  if (!meta) return;
  const { y, m } = meta;
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const dim = daysInMonth(y, m);
  const eventDates = new Set((state.calendarMonthRows || []).map((r) => String(r.date || '').slice(0, 10)));
  const sel = state.calendarSelectedYmd;
  const todayYmd = ymd(new Date());
  const weekHtml = [0, 1, 2, 3, 4, 5, 6].map((w) => `<div class="calWeekday" aria-hidden="true">${esc(textFor(`calWeek${w}`))}</div>`).join('');
  let cells = '';
  for (let i = 0; i < startWeekday; i += 1) cells += '<div class="calCell calCell--pad" aria-hidden="true"></div>';
  for (let d = 1; d <= dim; d += 1) {
    const ymdStr = ymdFromParts(y, m, d);
    const has = eventDates.has(ymdStr);
    const isSel = sel === ymdStr;
    const isToday = ymdStr === todayYmd;
    cells += `<button type="button" class="calCell ${has ? 'calCell--has' : 'calCell--muted'} ${isSel ? 'calCell--selected' : ''} ${isToday ? 'calCell--today' : ''}" data-cal-day="${esc(ymdStr)}" aria-pressed="${isSel ? 'true' : 'false'}">${d}</button>`;
  }
  host.innerHTML = `
    <div class="calendarMonthWrap">
      <div class="calWeekdays">${weekHtml}</div>
      <div class="calendarGrid" role="grid" aria-label="${esc(textFor('pageCalendarTitle'))}">${cells}</div>
    </div>`;
}

export function renderCalendarDayTable({ state, $, esc, textFor, textForVars }) {
  const host = $('calendarDayList') || $('calendar');
  if (!host) return;
  renderCalendarEventEditor({ state, $, esc });
  const headEl = $('calendarDayHeadingText');
  const sel = String(state.calendarSelectedYmd || '').slice(0, 10);
  const rangeFrom = String(state.calendarRangeFrom || '').slice(0, 10);
  const rangeTo = String(state.calendarRangeTo || '').slice(0, 10);

  // Range mode: show all fetched rows in the selected date range.
  if (!sel) {
    const rowsAll = [...(state.calendarMonthRows || [])].sort(
      (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.title || '').localeCompare(String(b.title || '')),
    );
    const dates = [...new Set(rowsAll.map((r) => String(r.date || '').slice(0, 10)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const focus = state.calendarRangeFocusYmd || (dates[0] || '__all__');
    const focusIdx = dates.indexOf(focus);
    const canPrev = focus !== '__all__' && focusIdx > 0;
    const canNext = focus !== '__all__' && focusIdx >= 0 && focusIdx < dates.length - 1;

    if (headEl) {
      headEl.textContent =
        focus === '__all__'
          ? textForVars('calendarEventsForRange', { from: rangeFrom || '-', to: rangeTo || '-' })
          : textForVars('calendarEventsForDayOn', { date: focus });
    }

    const rows =
      focus === '__all__' ? rowsAll : rowsAll.filter((r) => String(r.date || '').slice(0, 10) === focus);

    host.innerHTML =
      dates.length === 0
        ? `<p class="muted">${esc(textFor('calendarEmptyDay'))}</p>`
        : `
          <div class="pager" style="margin-bottom:10px">
            <div class="muted">${esc(textForVars('calendarEventsForRange', { from: rangeFrom || '-', to: rangeTo || '-' }))}</div>
            <div class="row">
              <button class="secondary" data-calendar-range-prev="1" ${canPrev ? '' : 'disabled'}>${esc(textFor('btnPrevious'))}</button>
              <select data-calendar-range-day="pick">
                <option value="__all__"${focus === '__all__' ? ' selected' : ''}>${esc(textFor('tabAll'))}</option>
                ${dates.map((d) => `<option value="${esc(d)}"${d === focus ? ' selected' : ''}>${esc(d)}</option>`).join('')}
              </select>
              <button class="secondary" data-calendar-range-next="1" ${canNext ? '' : 'disabled'}>${esc(textFor('btnNext'))}</button>
            </div>
          </div>
          ${
            rows.length === 0
              ? `<p class="muted">${esc(textFor('calendarEmptyDay'))}</p>`
              : `${calendarEventTable({ rows, esc, textFor })}${calendarEventCards({ rows, esc, textFor })}`
          }
        `;
    return;
  }

  if (headEl) headEl.textContent = textForVars('calendarEventsForDayOn', { date: formatAdminCalendarDayHeading(sel) });
  const rows = (state.calendarMonthRows || []).filter((r) => String(r.date || '').slice(0, 10) === sel);
  host.innerHTML =
    rows.length === 0
      ? `<p class="muted">${esc(textFor('calendarEmptyDay'))}</p>`
      : `${calendarEventTable({ rows, esc, textFor })}${calendarEventCards({ rows, esc, textFor })}`;
}

export async function loadCalendarView(ctx) {
  const { api, $, state, esc, textFor, ymd } = ctx;
  const host = $('calendarDayList') || $('calendar');
  if (!host) return;
  initCalendarMonthIfNeeded({ state, ymd });

  // Prefer explicit range (news-like) when inputs exist.
  const fromValue = $('calendarFrom')?.value?.slice(0, 10) || '';
  const toValue = $('calendarTo')?.value?.slice(0, 10) || '';
  const from = fromValue || calendarMonthMeta(state.calendarMonthYm)?.first || '';
  const to = toValue || calendarMonthMeta(state.calendarMonthYm)?.last || '';
  if (!from || !to) return;

  // Drive the month grid by the "from" month.
  state.calendarMonthYm = from.slice(0, 7);
  const meta = calendarMonthMeta(state.calendarMonthYm);
  if (!meta) return;

  const params = new URLSearchParams({ page: '1', pageSize: '500', from, to });
  state.calendarRangeFrom = from;
  state.calendarRangeTo = to;
  const ty = $('calendarType')?.value?.trim();
  if (ty) params.set('type', ty);
  const cq = $('calendarQuery')?.value?.trim();
  if (cq) params.set('q', cq);
  const sym = $('calendarSymbol')?.value?.trim();
  if (sym) params.set('symbol', sym.toUpperCase());
  const body = await api(`/admin/api/calendar?${params.toString()}`);
  state.calendarMonthRows = Array.isArray(body.data) ? body.data : [];
  state.calendarTotal = body.total;
  state.calendarPage = body.page;
  state.calendarTotalPages = body.totalPages;
  // If a specific day is selected (via grid click), keep it; otherwise show range mode.
  if (state.calendarSelectedYmd) {
    const sel = String(state.calendarSelectedYmd).slice(0, 10);
    if (!state.calendarMonthRows.some((r) => String(r.date || '').slice(0, 10) === sel)) {
      state.calendarSelectedYmd = '';
    }
  }
  // Reset range navigator when query changes
  if (!state.calendarSelectedYmd) {
    const allDates = [...new Set((state.calendarMonthRows || []).map((r) => String(r.date || '').slice(0, 10)).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
    if (!state.calendarRangeFocusYmd || (state.calendarRangeFocusYmd !== '__all__' && !allDates.includes(state.calendarRangeFocusYmd))) {
      state.calendarRangeFocusYmd = allDates[0] || '__all__';
    }
  }
  renderCalendarSummary({ state, $, esc, textFor });
  renderAdminCalendarGrid({ state, $, esc, textFor, ymd });
  renderCalendarDayTable({ state, $, esc, textFor, textForVars: ctx.textForVars });
  const mappings = await api('/admin/api/calendar/event-code-mappings');
  state.calendarEventCodeMappings = Array.isArray(mappings.data) ? mappings.data : [];
  renderCalendarEventCodeMappings({ state, $, esc });
  const jobs = await api('/admin/api/jobs');
  state.calendarJobs = Array.isArray(jobs.data)
    ? jobs.data.filter((job) => String(job.area || job.domain || '').trim() === 'calendar')
    : [];
  renderCalendarJobRunner({ state, $, esc });
}

export function newCalendarEventDraftView(ctx) {
  const { $, state, esc } = ctx;
  state.calendarEventDraft = emptyCalendarDraft(state);
  renderCalendarEventEditor({ state, $, esc });
}

export function editCalendarEventDraftView(ctx) {
  const { $, state, esc, id } = ctx;
  const row = (state.calendarMonthRows || []).find((item) => item.id === id);
  if (!row) return;
  state.calendarEventDraft = draftFromEvent(row);
  renderCalendarEventEditor({ state, $, esc });
}

function readCalendarEventEditor($, state) {
  const draft = state.calendarEventDraft || {};
  return {
    id: draft.id || '',
    date: $('calendarEventDate')?.value || '',
    type: $('calendarEventType')?.value || 'macro',
    country: $('calendarEventCountry')?.value || '',
    symbol: $('calendarEventSymbol')?.value || '',
    title: $('calendarEventTitle')?.value || '',
    timeLabel: $('calendarEventTimeLabel')?.value || '',
    impact: $('calendarEventImpact')?.value || '',
    actual: $('calendarEventActual')?.value || null,
    estimate: $('calendarEventEstimate')?.value || null,
    previous: $('calendarEventPrevious')?.value || null,
    unit: $('calendarEventUnit')?.value || '',
    provider: 'admin',
    source: 'admin',
    sourceEventId: $('calendarEventSourceEventId')?.value || '',
  };
}

export async function saveCalendarEventView(ctx) {
  const { api, $, state } = ctx;
  const body = readCalendarEventEditor($, state);
  const id = body.id || '';
  await api(id ? `/admin/api/calendar/events/${encodeURIComponent(id)}` : '/admin/api/calendar/events', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
  state.calendarEventDraft = null;
}

export async function deleteCalendarEventView(ctx) {
  const { api, state } = ctx;
  const id = state.calendarEventDraft?.id || '';
  if (!id) return;
  await api(`/admin/api/calendar/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
  state.calendarEventDraft = null;
}

export async function runCalendarJobView(ctx) {
  const { api, jobKey } = ctx;
  if (!jobKey) return;
  await api(`/admin/api/jobs/${encodeURIComponent(jobKey)}/run`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'full' }),
  });
}

export async function saveCalendarEventCodeMappingView(ctx) {
  const { api, $, state, esc } = ctx;
  const body = {
    eventType: $('calendarMappingEventType')?.value || 'macro',
    code: $('calendarMappingCode')?.value || '',
    label: $('calendarMappingLabel')?.value || '',
    matchType: $('calendarMappingMatchType')?.value || 'contains',
    pattern: $('calendarMappingPattern')?.value || '',
    priority: 1000,
    enabled: true,
  };
  await api('/admin/api/calendar/event-code-mappings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const mappings = await api('/admin/api/calendar/event-code-mappings');
  state.calendarEventCodeMappings = Array.isArray(mappings.data) ? mappings.data : [];
  renderCalendarEventCodeMappings({ state, $, esc });
}

export async function deleteCalendarEventCodeMappingView(ctx) {
  const { api, $, state, esc, id } = ctx;
  if (!id) return;
  await api(`/admin/api/calendar/event-code-mappings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const mappings = await api('/admin/api/calendar/event-code-mappings');
  state.calendarEventCodeMappings = Array.isArray(mappings.data) ? mappings.data : [];
  renderCalendarEventCodeMappings({ state, $, esc });
}
